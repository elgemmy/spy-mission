import type { RoomUiState, SharedRoomRecord } from "./types.js";

export function normalizeRoomRecord<T extends SharedRoomRecord>(room: T): T {
  return {
    ...room,
    ui: normalizeRoomUi(room.ui),
  } as T;
}

export function normalizeRoomUi(ui: Partial<RoomUiState> | null): RoomUiState {
  return {
    votes: ui?.votes ?? {},
    clueLog: ui?.clueLog ?? [],
    banners: ui?.banners ?? [],
  };
}
