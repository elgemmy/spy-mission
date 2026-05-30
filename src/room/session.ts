import { IllegalMove } from "../engine/contract";
import { initialState, reducer } from "../engine/codenames";
import type { Action, Concept, GameState, Lang } from "../engine";
import type {
  CreateRoomInput,
  RoomRecord,
  RoomUiState,
  RoomVisibility,
} from "./types";

export type RoomErrorCode =
  | "NOT_HOST"
  | "ROOM_PRIVATE"
  | "PLAYER_NOT_FOUND"
  | "HOST_REMOVE_FORBIDDEN";

export class RoomError extends Error {
  readonly code: RoomErrorCode;

  constructor(code: RoomErrorCode, message?: string) {
    super(message ?? code);
    this.name = "RoomError";
    this.code = code;
  }
}

export function createRoomRecord(input: CreateRoomInput): RoomRecord {
  const baseState = initialState({ roomId: input.id, lang: input.lang });
  const state = reducer(
    baseState,
    { type: "joinRoom", name: input.hostName },
    input.hostId,
  );

  return {
    id: input.id,
    code: input.code.toUpperCase(),
    hostId: input.hostId,
    visibility: input.visibility ?? "public",
    state,
    ui: emptyUi(),
    version: 1,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function joinRoomRecord(
  room: RoomRecord,
  playerId: string,
  name: string,
  now: string,
): RoomRecord {
  if (room.state.players[playerId]) {
    return room;
  }
  if (room.visibility === "private") {
    throw new RoomError("ROOM_PRIVATE");
  }
  return withState(
    room,
    reducer(room.state, { type: "joinRoom", name }, playerId),
    now,
  );
}

export function dispatchRoomAction(
  room: RoomRecord,
  action: Action,
  playerId: string,
  now: string,
): RoomRecord {
  const state = reducer(room.state, action, playerId);
  let ui = room.ui;

  if (action.type === "giveClue" && state.clue) {
    ui = {
      ...room.ui,
      clueLog: [
        ...room.ui.clueLog,
        {
          id: `${room.version + 1}-${room.ui.clueLog.length + 1}`,
          team: room.state.turn,
          clue: state.clue,
        },
      ],
      votes: {},
    };
  }

  if (action.type === "endTurn" || action.type === "startGame") {
    ui = { ...ui, votes: {} };
  }

  return touch({ ...room, state, ui }, now);
}

export function updateRoomSettings(
  room: RoomRecord,
  playerId: string,
  settings: { visibility?: RoomVisibility; lang?: Lang },
  now: string,
): RoomRecord {
  assertHost(room, playerId);
  const state = settings.lang
    ? reducer(room.state, { type: "setLang", lang: settings.lang }, playerId)
    : room.state;

  return touch(
    {
      ...room,
      visibility: settings.visibility ?? room.visibility,
      state,
    },
    now,
  );
}

export function transferHost(
  room: RoomRecord,
  playerId: string,
  nextHostId: string,
  now: string,
): RoomRecord {
  assertHost(room, playerId);
  if (!room.state.players[nextHostId]) {
    throw new RoomError("PLAYER_NOT_FOUND");
  }
  return touch({ ...room, hostId: nextHostId }, now);
}

export function removePlayer(
  room: RoomRecord,
  playerId: string,
  targetPlayerId: string,
  now: string,
): RoomRecord {
  assertHost(room, playerId);
  if (targetPlayerId === room.hostId) {
    throw new RoomError("HOST_REMOVE_FORBIDDEN");
  }
  if (!room.state.players[targetPlayerId]) {
    throw new RoomError("PLAYER_NOT_FOUND");
  }

  const players = { ...room.state.players };
  delete players[targetPlayerId];

  const votes = { ...room.ui.votes };
  delete votes[targetPlayerId];

  return touch(
    {
      ...room,
      state: { ...room.state, players },
      ui: { ...room.ui, votes },
    },
    now,
  );
}

export function voteCard(
  room: RoomRecord,
  playerId: string,
  cardIndex: number,
  now: string,
): RoomRecord {
  assertCanVote(room.state, playerId, cardIndex);
  return touch(
    {
      ...room,
      ui: {
        ...room.ui,
        votes: { ...room.ui.votes, [playerId]: cardIndex },
      },
    },
    now,
  );
}

export function clearVote(
  room: RoomRecord,
  playerId: string,
  now: string,
): RoomRecord {
  if (!(playerId in room.ui.votes)) {
    return room;
  }
  const votes = { ...room.ui.votes };
  delete votes[playerId];
  return touch({ ...room, ui: { ...room.ui, votes } }, now);
}

export function confirmGuess(
  room: RoomRecord,
  playerId: string,
  cardIndex: number,
  now: string,
): RoomRecord {
  const target = room.state.board[cardIndex];
  if (target?.revealed) {
    return room;
  }

  const state = reducer(room.state, { type: "guess", cardIndex }, playerId);
  return touch(
    {
      ...room,
      state,
      ui: { ...room.ui, votes: {} },
    },
    now,
  );
}

export function returnToLobby(
  room: RoomRecord,
  playerId: string,
  now: string,
): RoomRecord {
  assertHost(room, playerId);
  return touch(
    {
      ...room,
      state: lobbyStateFrom(room),
      ui: emptyUi(),
    },
    now,
  );
}

export function startNewGame(
  room: RoomRecord,
  playerId: string,
  concepts: Concept[],
  seed: number,
  now: string,
): RoomRecord {
  assertHost(room, playerId);
  const lobby = lobbyStateFrom(room);
  const state = reducer(lobby, { type: "startGame", concepts, seed }, playerId);
  return touch(
    {
      ...room,
      state,
      ui: emptyUi(),
    },
    now,
  );
}

function assertCanVote(
  state: GameState,
  playerId: string,
  cardIndex: number,
): void {
  if (state.phase !== "guess") {
    throw new IllegalMove("WRONG_PHASE");
  }
  const me = state.players[playerId];
  if (!me) {
    throw new IllegalMove("NOT_A_PLAYER");
  }
  if (me.role !== "operative") {
    throw new IllegalMove("WRONG_ROLE");
  }
  if (me.team !== state.turn) {
    throw new IllegalMove("NOT_YOUR_TURN");
  }
  if (cardIndex < 0 || cardIndex > 24 || !state.board[cardIndex]) {
    throw new IllegalMove("CARD_OUT_OF_RANGE");
  }
  if (state.board[cardIndex]?.revealed) {
    throw new IllegalMove("CARD_ALREADY_REVEALED");
  }
}

function assertHost(room: RoomRecord, playerId: string): void {
  if (room.hostId !== playerId) {
    throw new RoomError("NOT_HOST");
  }
}

function emptyUi(): RoomUiState {
  return { votes: {}, clueLog: [] };
}

function lobbyStateFrom(room: RoomRecord): GameState {
  return {
    ...initialState({ roomId: room.id, lang: room.state.lang }),
    players: room.state.players,
  };
}

function withState(
  room: RoomRecord,
  state: GameState,
  now: string,
): RoomRecord {
  return touch({ ...room, state }, now);
}

function touch(room: RoomRecord, now: string): RoomRecord {
  return {
    ...room,
    version: room.version + 1,
    updatedAt: now,
  };
}
