import type {
  Clue,
  GameState,
  Lang,
  PlayerView,
  Role,
  Team,
} from "../engine/index.js";
import type {
  PartnerMissionState,
  PartnerMissionView,
} from "../engine/partnerMission/index.js";

export type Unsubscribe = () => void;
export type RoomVisibility = "public" | "private";
export type RoomMode = "classic" | "partner";
export const MAX_ROOM_PLAYERS = 12;

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
  mode?: "classic";
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

export interface PartnerRoomRecord {
  mode: "partner";
  id: string;
  code: string;
  hostId: string;
  visibility: "private";
  state: PartnerMissionState;
  ui: RoomUiState;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type SharedRoomRecord = RoomRecord | PartnerRoomRecord;

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
  create(room: SharedRoomRecord): Promise<void>;
  delete(roomId: string): Promise<void>;
  load(roomId: string): Promise<SharedRoomRecord | null>;
  loadByCode(code: string): Promise<SharedRoomRecord | null>;
  save(room: SharedRoomRecord, expectedVersion?: number): Promise<void>;
  subscribe(
    roomId: string,
    onChange: (room: SharedRoomRecord | null) => void,
  ): Unsubscribe;
}

export interface RoomSnapshot {
  mode?: "classic";
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

export interface PartnerRoomSnapshot {
  mode: "partner";
  id: string;
  code: string;
  hostId: string;
  visibility: "private";
  view: PartnerMissionView;
  version: number;
  createdAt: string;
  updatedAt: string;
  inviteToken?: string;
}

export type SharedRoomSnapshot = RoomSnapshot | PartnerRoomSnapshot;

export interface CreateSharedRoomInput {
  name: string;
  lang: Lang;
  visibility?: RoomVisibility;
  mode?: RoomMode;
}

export type CreateClassicRoomInput = CreateSharedRoomInput & {
  mode?: "classic";
};
export type CreatePartnerRoomInput = CreateSharedRoomInput & {
  mode: "partner";
};

export interface JoinSharedRoomInput {
  code: string;
  name: string;
  inviteToken?: string;
}

export type ClaimPartnerSeatInput = JoinSharedRoomInput;

export type ResumeRoomResult =
  | { status: "active"; room: SharedRoomSnapshot }
  | { status: "join"; code: string; mode: "partner" }
  | { status: "join"; code: string; mode?: "classic" }
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
  | { type: "giveSignal"; word: string; count: number }
  | { type: "lockGuesses"; cardIds: string[]; fieldNote?: string }
  | { type: "resolveLockedGuesses" }
  | { type: "leaveRoom" }
  | { type: "banPlayer"; targetPlayerId: string }
  | { type: "deleteRoom" };

export type RoomMutationResult =
  | SharedRoomSnapshot
  | { left: true }
  | { deleted: true };

export interface RoomProvider {
  create(input: CreatePartnerRoomInput): Promise<PartnerRoomSnapshot>;
  create(input: CreateClassicRoomInput): Promise<RoomSnapshot>;
  resume(code: string): Promise<ResumeRoomResult>;
  join(input: JoinSharedRoomInput): Promise<RoomSnapshot>;
  claimPartnerSeat(input: ClaimPartnerSeatInput): Promise<PartnerRoomSnapshot>;
  load(roomId: string): Promise<SharedRoomSnapshot | null>;
  mutate(
    roomId: string,
    expectedVersion: number,
    command: RoomCommand,
  ): Promise<RoomMutationResult>;
  getInviteToken(roomId: string): string | null;
  clearRoomStorage(roomId: string): void;
  subscribe(
    roomId: string,
    onChange: (room: SharedRoomSnapshot | null) => void,
  ): Unsubscribe;
}
