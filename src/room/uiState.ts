import type { RoomRecord, RoomUiState } from "./types.js";

export function normalizeRoomRecord(room: RoomRecord): RoomRecord {
  return {
    ...room,
    ui: normalizeRoomUi(room.ui),
  };
}

export function normalizeRoomUi(ui: Partial<RoomUiState> | null): RoomUiState {
  return {
    votes: ui?.votes ?? {},
    clueLog: ui?.clueLog ?? [],
    banners: ui?.banners ?? [],
  };
}
