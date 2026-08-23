import { describe, expect, it } from "vitest";
import { IllegalMove, reducer, type GameState } from "../engine";
import { makeConcepts, startTestGame } from "../engine/codenames/testFixtures";
import {
  confirmGuess,
  createRoomRecord,
  dispatchRoomAction,
  joinRoomRecord,
  renamePlayer,
  returnToLobby,
  startNewGame,
  voteCard,
} from "./session";
import type { RoomRecord } from "./types";

const NOW = "2026-05-31T00:00:00.000Z";
const LATER = "2026-05-31T00:00:01.000Z";

describe("room session orchestration", () => {
  it("creates and joins public rooms without leaking into engine actions", () => {
    const created = createRoomRecord({
      id: "room-1",
      code: "abc12",
      hostId: "host",
      hostName: "Host",
      lang: "ar",
      now: NOW,
    });

    const joined = joinRoomRecord(created, "guest", "Guest", LATER);

    expect(created.code).toBe("ABC12");
    expect(joined.state.players.host?.name).toBe("Host");
    expect(joined.state.players.guest?.name).toBe("Guest");
    expect(joined.version).toBe(created.version + 1);
  });

  it("allows private joins only when the invite link path is used", () => {
    const room = {
      ...createRoomRecord({
        id: "room-private",
        code: "secret",
        hostId: "host",
        hostName: "Host",
        lang: "ar",
        now: NOW,
      }),
      visibility: "private" as const,
    };

    expect(() =>
      joinRoomRecord(room, "code-guest", "Guest", LATER),
    ).toThrowError(expect.objectContaining({ code: "ROOM_PRIVATE" }));

    const joined = joinRoomRecord(room, "link-guest", "Guest", LATER, {
      allowPrivate: true,
    });
    expect(joined.state.players["link-guest"]?.name).toBe("Guest");
  });

  it("rejects active-room joins without reclaiming a same-name player", () => {
    const active = roomFromState(startTestGame());
    const staleHost = active.state.players["p-red-sm"];

    expect(() =>
      joinRoomRecord(active, "new-host", staleHost.name, LATER),
    ).toThrowError(
      expect.objectContaining({
        code: "WRONG_PHASE",
      } satisfies Partial<IllegalMove>),
    );
    expect(active.hostId).toBe("p-red-sm");
    expect(active.state.players["p-red-sm"]).toEqual(staleHost);
    expect(active.state.players["new-host"]).toBeUndefined();
  });

  it("does not replace same-name players during normal lobby joins", () => {
    const created = createRoomRecord({
      id: "room-same-name",
      code: "same",
      hostId: "host",
      hostName: "Same",
      lang: "ar",
      now: NOW,
    });

    const joined = joinRoomRecord(created, "guest", "Same", LATER);

    expect(joined.state.players.host?.name).toBe("Same");
    expect(joined.state.players.guest?.name).toBe("Same");
    expect(joined.hostId).toBe("host");
  });

  it("does not reclaim active-game names when the match is ambiguous", () => {
    const active = roomFromState(startTestGame());
    const ambiguous: RoomRecord = {
      ...active,
      state: {
        ...active.state,
        players: {
          ...active.state.players,
          staleA: { name: "Same", team: "red", role: "operative" },
          staleB: { name: "Same", team: "blue", role: "operative" },
        },
      },
    };

    expect(() => joinRoomRecord(ambiguous, "new", "Same", LATER)).toThrowError(
      expect.objectContaining({
        code: "WRONG_PHASE",
      } satisfies Partial<IllegalMove>),
    );
    expect(ambiguous.state.players.staleA?.name).toBe("Same");
    expect(ambiguous.state.players.staleB?.name).toBe("Same");
  });

  it("renames a joined player in lobby and active games", () => {
    const lobby = createRoomRecord({
      id: "room-rename",
      code: "names",
      hostId: "host",
      hostName: "Before",
      lang: "ar",
      now: NOW,
    });

    const lobbyRenamed = renamePlayer(lobby, "host", "  After  ", LATER);
    expect(lobbyRenamed.state.players.host?.name).toBe("After");

    const active = roomFromState(startTestGame());
    const activeRenamed = renamePlayer(active, "p-red-op", "مراوغ", LATER);
    expect(activeRenamed.state.players["p-red-op"]?.name).toBe("مراوغ");
    expect(activeRenamed.state.phase).toBe(active.state.phase);
  });

  it("rejects empty rename values and missing players", () => {
    const room = createRoomRecord({
      id: "room-rename-invalid",
      code: "badnm",
      hostId: "host",
      hostName: "Host",
      lang: "ar",
      now: NOW,
    });

    expect(() => renamePlayer(room, "host", "   ", LATER)).toThrowError(
      expect.objectContaining({ code: "INVALID_NAME" }),
    );
    expect(() => renamePlayer(room, "missing", "Name", LATER)).toThrowError(
      expect.objectContaining({ code: "PLAYER_NOT_FOUND" }),
    );
  });

  it("records an active operative vote without revealing", () => {
    const room = roomFromState(giveActiveClue(startTestGame()));
    const operativeId = activeOperativeId(room.state);

    const next = voteCard(room, operativeId, 3, LATER);

    expect(next.ui.votes[operativeId]).toBe(3);
    expect(next.state.board[3]?.revealed).toBe(false);
    expect(next.state.guessesMadeThisTurn).toBe(0);
  });

  it("replaces a previous vote from the same player", () => {
    const room = roomFromState(giveActiveClue(startTestGame()));
    const operativeId = activeOperativeId(room.state);

    const first = voteCard(room, operativeId, 3, LATER);
    const second = voteCard(first, operativeId, 7, LATER);

    expect(second.ui.votes).toEqual({ [operativeId]: 7 });
  });

  it("rejects invalid voters and stale targets", () => {
    const room = roomFromState(giveActiveClue(startTestGame()));
    const spymasterId = activeSpymasterId(room.state);

    expect(() => voteCard(room, spymasterId, 0, LATER)).toThrowError(
      expect.objectContaining({
        code: "WRONG_ROLE",
      } satisfies Partial<IllegalMove>),
    );
    expect(() => voteCard(room, "spectator", 0, LATER)).toThrowError(
      expect.objectContaining({
        code: "NOT_A_PLAYER",
      } satisfies Partial<IllegalMove>),
    );
    expect(() =>
      voteCard(room, activeOperativeId(room.state), 99, LATER),
    ).toThrowError(
      expect.objectContaining({
        code: "CARD_OUT_OF_RANGE",
      } satisfies Partial<IllegalMove>),
    );
  });

  it("confirmGuess maps to the engine guess and clears votes", () => {
    const room = roomFromState(giveActiveClue(startTestGame()));
    const operativeId = activeOperativeId(room.state);
    const voted = voteCard(room, operativeId, 4, LATER);

    const confirmed = confirmGuess(voted, operativeId, 4, LATER);
    const engineOnly = reducer(
      room.state,
      { type: "guess", cardIndex: 4 },
      operativeId,
    );

    expect(confirmed.state).toEqual(engineOnly);
    expect(confirmed.ui.votes).toEqual({});
  });

  it("makes duplicate confirms idempotent once a card is revealed", () => {
    const room = roomFromState(giveActiveClue(startTestGame()));
    const operativeId = activeOperativeId(room.state);

    const confirmed = confirmGuess(room, operativeId, 0, LATER);
    const duplicate = confirmGuess(confirmed, operativeId, 0, LATER);

    expect(duplicate).toBe(confirmed);
  });

  it("preserves room state when confirmGuess is illegal", () => {
    const room = roomFromState(giveActiveClue(startTestGame()));
    const spymasterId = activeSpymasterId(room.state);

    expect(() => confirmGuess(room, spymasterId, 0, LATER)).toThrowError(
      expect.objectContaining({
        code: "WRONG_ROLE",
      } satisfies Partial<IllegalMove>),
    );
    expect(room.ui.votes).toEqual({});
    expect(room.state.guessesMadeThisTurn).toBe(0);
  });

  it("clears votes after a turn-ending confirm", () => {
    const state = giveActiveClue(startTestGame());
    const neutralIndex = state.board.findIndex(
      (card) => card.kind === "neutral",
    );
    const room = roomFromState(state);
    const operativeId = activeOperativeId(room.state);

    const voted = voteCard(room, operativeId, neutralIndex, LATER);
    const confirmed = confirmGuess(voted, operativeId, neutralIndex, LATER);

    expect(confirmed.state.turn).not.toBe(room.state.turn);
    expect(confirmed.ui.votes).toEqual({});
    expect(confirmed.ui.banners.at(-1)).toEqual({
      id: `3-turn-${confirmed.state.turn}`,
      type: "turn",
      team: confirmed.state.turn,
    });
  });

  it("adds assassin and winner banners when the black card is revealed", () => {
    const state = giveActiveClue(startTestGame());
    const assassinIndex = state.board.findIndex(
      (card) => card.kind === "assassin",
    );
    const operativeId = activeOperativeId(state);

    const confirmed = confirmGuess(
      roomFromState(state),
      operativeId,
      assassinIndex,
      LATER,
    );

    expect(confirmed.ui.banners).toEqual([
      {
        id: `2-assassin-${state.turn}`,
        type: "assassin",
        losingTeam: state.turn,
      },
      {
        id: `3-win-${confirmed.state.winner}`,
        type: "win",
        team: confirmed.state.winner,
      },
    ]);
  });

  it("adds a turn banner when players manually end a turn", () => {
    const state = giveActiveClue(startTestGame());
    const ownCardIndex = state.board.findIndex(
      (card) => card.kind === state.turn,
    );
    const operativeId = activeOperativeId(state);
    const guessed = confirmGuess(
      roomFromState(state),
      operativeId,
      ownCardIndex,
      LATER,
    );

    const ended = dispatchRoomAction(
      guessed,
      { type: "endTurn" },
      operativeId,
      LATER,
    );

    expect(ended.ui.banners.at(-1)).toEqual({
      id: `3-turn-${ended.state.turn}`,
      type: "turn",
      team: ended.state.turn,
    });
  });

  it("starts a fresh replay without an engine replay action", () => {
    const state = giveActiveClue(startTestGame());
    const assassinIndex = state.board.findIndex(
      (card) => card.kind === "assassin",
    );
    const operativeId = activeOperativeId(state);
    const ended = confirmGuess(
      roomFromState(state),
      operativeId,
      assassinIndex,
      LATER,
    );

    const replay = startNewGame(ended, "p-red-sm", makeConcepts(), 99, LATER);

    expect(ended.state.phase).toBe("ended");
    expect(replay.state.phase).toBe("clue");
    expect(replay.state.winner).toBeNull();
    expect(replay.state.board.every((card) => !card.revealed)).toBe(true);
    expect(replay.state.players).toEqual(ended.state.players);
    expect(replay.ui.votes).toEqual({});
    expect(replay.ui.banners.at(-1)).toEqual({
      id: `3-turn-${replay.state.turn}`,
      type: "turn",
      team: replay.state.turn,
    });
  });

  it("returns to lobby with roster and settings preserved", () => {
    const room = roomFromState(giveActiveClue(startTestGame()));
    const lobby = returnToLobby(room, "p-red-sm", LATER);

    expect(lobby.state.phase).toBe("lobby");
    expect(lobby.state.board).toEqual([]);
    expect(lobby.state.players).toEqual(room.state.players);
    expect(lobby.visibility).toBe(room.visibility);
  });
});

function roomFromState(state: GameState): RoomRecord {
  return {
    id: state.roomId,
    code: "ROOM1",
    hostId: "p-red-sm",
    visibility: "public",
    state,
    ui: { votes: {}, clueLog: [], banners: [] },
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function giveActiveClue(state: GameState): GameState {
  return reducer(
    state,
    { type: "giveClue", word: "hint", count: 2 },
    activeSpymasterId(state),
  );
}

function activeSpymasterId(state: GameState): string {
  return state.turn === "red" ? "p-red-sm" : "p-blue-sm";
}

function activeOperativeId(state: GameState): string {
  return state.turn === "red" ? "p-red-op" : "p-blue-op";
}
