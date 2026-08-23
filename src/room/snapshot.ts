import { viewFor } from "../engine";
import type { RoomRecord, RoomSnapshot } from "./types";

export function toRoomSnapshot(
  room: RoomRecord,
  playerId: string,
  inviteToken?: string,
): RoomSnapshot {
  return {
    id: room.id,
    code: room.code,
    hostId: room.hostId,
    visibility: room.visibility,
    view: viewFor(room.state, playerId),
    ui: room.ui,
    version: room.version,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    ...(inviteToken ? { inviteToken } : {}),
  };
}
