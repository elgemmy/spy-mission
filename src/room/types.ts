import type { Clue, GameState, Lang } from "../engine";

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

export interface RoomProvider {
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
