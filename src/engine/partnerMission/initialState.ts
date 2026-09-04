import { IllegalMove } from "../contract.js";
import { buildPartnerMissionBoard } from "./deal.js";
import {
  PARTNER_MAX_NAME_LENGTH,
  type PartnerMissionConfig,
  type PartnerMissionState,
} from "./types.js";

export function normalizePartnerName(name: string): string {
  const normalized = name.trim();
  if (normalized.length === 0 || normalized.length > PARTNER_MAX_NAME_LENGTH) {
    throw new IllegalMove("INVALID_NAME");
  }
  return normalized;
}

export function initialPartnerMissionState(
  config: PartnerMissionConfig,
): PartnerMissionState {
  return {
    mode: "partner",
    roomId: config.roomId,
    lang: config.lang,
    phase: "waiting_for_agent",
    board: buildPartnerMissionBoard(config.concepts, config.seed, config.kinds),
    missionLead: {
      id: config.missionLeadId,
      name: normalizePartnerName(config.missionLeadName),
    },
    fieldAgent: null,
    signal: null,
    lockedGuesses: null,
    previousTurn: null,
    turnNumber: 0,
  };
}
