import {
  initialPartnerMissionState,
  partnerMissionReducer,
  type PartnerCardKind,
  type PartnerMissionAction,
} from "../engine/partnerMission/index.js";
import type { Concept, Lang } from "../engine/index.js";
import { normalizeRoomUi } from "./uiState.js";
import type { PartnerRoomRecord } from "./types.js";

export interface CreatePartnerRoomRecordInput {
  id: string;
  code: string;
  hostId: string;
  hostName: string;
  lang: Lang;
  concepts: Concept[];
  seed: number;
  kinds?: PartnerCardKind[];
  now: string;
}

export function createPartnerRoomRecord(
  input: CreatePartnerRoomRecordInput,
): PartnerRoomRecord {
  return {
    mode: "partner",
    id: input.id,
    code: input.code.toUpperCase(),
    hostId: input.hostId,
    visibility: "private",
    state: initialPartnerMissionState({
      roomId: input.id,
      lang: input.lang,
      missionLeadId: input.hostId,
      missionLeadName: input.hostName,
      concepts: input.concepts,
      seed: input.seed,
      ...(input.kinds ? { kinds: input.kinds } : {}),
    }),
    ui: normalizeRoomUi(null),
    version: 1,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function applyPartnerRoomAction(
  room: PartnerRoomRecord,
  actorId: string,
  action: PartnerMissionAction,
  now: string,
): PartnerRoomRecord {
  const state = partnerMissionReducer(room.state, action, actorId);
  if (state === room.state) {
    return room;
  }
  return {
    ...room,
    state,
    version: room.version + 1,
    updatedAt: now,
  };
}

export function isPartnerRoomMember(
  room: PartnerRoomRecord,
  actorId: string,
): boolean {
  return (
    room.state.missionLead.id === actorId ||
    room.state.fieldAgent?.id === actorId
  );
}
