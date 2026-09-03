import { viewFor } from "../engine/index.js";
import { partnerMissionViewFor } from "../engine/partnerMission/index.js";
import type {
  PartnerRoomRecord,
  PartnerRoomSnapshot,
  RoomRecord,
  RoomSnapshot,
  SharedRoomRecord,
  SharedRoomSnapshot,
} from "./types.js";

export function toRoomSnapshot(
  room: RoomRecord,
  playerId: string,
  inviteToken?: string,
): RoomSnapshot;
export function toRoomSnapshot(
  room: PartnerRoomRecord,
  playerId: string,
  inviteToken?: string,
): PartnerRoomSnapshot;
export function toRoomSnapshot(
  room: SharedRoomRecord,
  playerId: string,
  inviteToken?: string,
): SharedRoomSnapshot;

export function toRoomSnapshot(
  room: SharedRoomRecord,
  playerId: string,
  inviteToken?: string,
): SharedRoomSnapshot {
  if (room.mode === "partner") {
    return {
      mode: "partner",
      id: room.id,
      code: room.code,
      hostId: room.hostId,
      visibility: "private",
      view: partnerMissionViewFor(room.state, playerId),
      version: room.version,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      ...(inviteToken ? { inviteToken } : {}),
    };
  }
  return {
    mode: "classic",
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
