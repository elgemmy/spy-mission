import type { GameModule } from "../contract.js";
import { initialPartnerMissionState } from "./initialState.js";
import { partnerMissionReducer } from "./reducer.js";
import type {
  PartnerMissionAction,
  PartnerMissionConfig,
  PartnerMissionState,
  PartnerMissionView,
} from "./types.js";
import { partnerMissionViewFor } from "./viewFor.js";

export { buildPartnerMissionBoard } from "./deal.js";
export {
  initialPartnerMissionState,
  normalizePartnerName,
} from "./initialState.js";
export { partnerMissionReducer } from "./reducer.js";
export {
  PARTNER_BOARD_SIZE,
  PARTNER_DECOY_COUNT,
  PARTNER_MAX_FIELD_NOTE_LENGTH,
  PARTNER_MAX_NAME_LENGTH,
  PARTNER_MAX_SIGNAL_COUNT,
  PARTNER_MAX_SIGNAL_LENGTH,
  PARTNER_MIN_SIGNAL_COUNT,
  PARTNER_TARGET_COUNT,
  PARTNER_TRAP_COUNT,
} from "./types.js";
export type {
  LockedPartnerGuesses,
  PartnerCardKind,
  PartnerFieldAgentView,
  PartnerFieldCard,
  PartnerLeadCard,
  PartnerMissionAction,
  PartnerMissionCapabilities,
  PartnerMissionCard,
  PartnerMissionConfig,
  PartnerMissionLeadView,
  PartnerMissionOnboardingView,
  PartnerMissionPhase,
  PartnerMissionPlayer,
  PartnerMissionRole,
  PartnerMissionSignal,
  PartnerMissionState,
  PartnerMissionView,
  PartnerPreviousTurn,
  PartnerReveal,
  PartnerTurnStopReason,
} from "./types.js";
export { partnerMissionViewFor } from "./viewFor.js";

export const partnerMission: GameModule<
  PartnerMissionState,
  PartnerMissionAction,
  PartnerMissionView,
  PartnerMissionConfig
> = {
  id: "partner-mission",
  initialState: initialPartnerMissionState,
  reducer: partnerMissionReducer,
  viewFor: partnerMissionViewFor,
};
