import type {
  Clue,
  GameState,
  Lang,
  PlayerView,
  Role,
  Team,
} from "../engine/index.js";

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

export type ResumeRoomResult =
  | { status: "active"; room: RoomSnapshot }
  | { status: "join"; code: string }
  | { status: "notFound" };

export type RoomStateCommand =
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
  | { type: "renamePlayer"; name: string };

export type RoomCommand =
  | RoomStateCommand
  | { type: "leaveRoom" }
  | { type: "banPlayer"; targetPlayerId: string }
  | { type: "deleteRoom" }
  | { type: "regenerateInvite" };

export type RoomMutationResult =
  | RoomSnapshot
  | { left: true }
  | { deleted: true };

export interface RoomProvider {
  create(input: CreateSharedRoomInput): Promise<RoomSnapshot>;
  resume(code: string): Promise<ResumeRoomResult>;
  join(input: JoinSharedRoomInput): Promise<RoomSnapshot>;
  load(roomId: string): Promise<RoomSnapshot | null>;
  mutate(
    roomId: string,
    expectedVersion: number,
    command: RoomCommand,
  ): Promise<RoomMutationResult>;
  getInviteToken(roomId: string): string | null;
  clearRoomStorage(roomId: string): void;
  subscribe(
    roomId: string,
    onChange: (room: RoomSnapshot | null) => void,
  ): Unsubscribe;
}
