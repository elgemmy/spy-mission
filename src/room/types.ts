import type { Clue, GameState, Lang, PlayerView, Role, Team } from "../engine";

export type Unsubscribe = () => void;
export type RoomVisibility = "public" | "private";

export interface ClueLogEntry {
  id: string;
  team: "red" | "blue";
  clue: Clue;
}

export type GameBanner =
  | { id: string; type: "turn"; team: "red" | "blue" }
  | { id: string; type: "win"; team: "red" | "blue" }
  | { id: string; type: "assassin"; losingTeam: "red" | "blue" };

export interface RoomUiState {
  votes: Record<string, number | null>;
  clueLog: ClueLogEntry[];
  banners: GameBanner[];
}

export interface RoomRecord {
  id: string;
  code: string;
  hostId: string;
  visibility: RoomVisibility;
  state: GameState;
  ui: RoomUiState;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoomInput {
  id: string;
  code: string;
  hostId: string;
  hostName: string;
  lang: Lang;
  visibility?: RoomVisibility;
  now: string;
}

export interface RoomStorage {
  create(room: RoomRecord): Promise<void>;
  delete(roomId: string): Promise<void>;
  load(roomId: string): Promise<RoomRecord | null>;
  loadByCode(code: string): Promise<RoomRecord | null>;
  save(room: RoomRecord, expectedVersion?: number): Promise<void>;
  subscribe(
    roomId: string,
    onChange: (room: RoomRecord | null) => void,
  ): Unsubscribe;
}

export interface RoomSnapshot {
  id: string;
  code: string;
  hostId: string;
  visibility: RoomVisibility;
  view: PlayerView;
  ui: RoomUiState;
  version: number;
  createdAt: string;
  updatedAt: string;
  inviteToken?: string;
}

export interface CreateSharedRoomInput {
  name: string;
  lang: Lang;
  visibility?: RoomVisibility;
}

export interface JoinSharedRoomInput {
  code: string;
  name: string;
  inviteToken?: string;
}

export type RoomCommand =
  | { type: "assignSelf"; team: Team; role: Role }
  | { type: "setLang"; lang: Lang }
  | { type: "setVisibility"; visibility: RoomVisibility }
  | { type: "startGame" }
  | { type: "giveClue"; word: string; count: number }
  | { type: "vote"; cardIndex: number }
  | { type: "clearVote" }
  | { type: "confirmGuess"; cardIndex: number }
  | { type: "endTurn" }
  | { type: "returnToLobby" }
  | { type: "transferHost"; nextHostId: string }
  | { type: "removePlayer"; targetPlayerId: string }
  | { type: "renamePlayer"; name: string };

export interface RoomProvider {
  create(input: CreateSharedRoomInput): Promise<RoomSnapshot>;
  join(input: JoinSharedRoomInput): Promise<RoomSnapshot>;
  load(roomId: string): Promise<RoomSnapshot | null>;
  mutate(
    roomId: string,
    expectedVersion: number,
    command: RoomCommand,
  ): Promise<RoomSnapshot>;
  delete(roomId: string): Promise<void>;
  ensureInvite(roomId: string, expectedVersion: number): Promise<string>;
  subscribe(
    roomId: string,
    onChange: (room: RoomSnapshot | null) => void,
  ): Unsubscribe;
}
