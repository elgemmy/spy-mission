import type { Concept, Lang } from "../codenames/types.js";

export const PARTNER_BOARD_SIZE = 25;
export const PARTNER_TARGET_COUNT = 8;
export const PARTNER_DECOY_COUNT = 16;
export const PARTNER_TRAP_COUNT = 1;
export const PARTNER_MIN_SIGNAL_COUNT = 1;
export const PARTNER_MAX_SIGNAL_COUNT = 8;
export const PARTNER_MAX_SIGNAL_LENGTH = 40;
export const PARTNER_MAX_NAME_LENGTH = 32;
export const PARTNER_MAX_FIELD_NOTE_LENGTH = 160;

export type PartnerMissionPhase =
  | "waiting_for_agent"
  | "waiting_for_signal"
  | "field_agent_turn"
  | "locked"
  | "won"
  | "lost";

export type PartnerCardKind = "target" | "decoy" | "trap";
export type PartnerMissionRole = "mission_lead" | "field_agent";

export interface PartnerMissionPlayer {
  id: string;
  name: string;
}

export interface PartnerMissionCard {
  id: string;
  concept: Concept;
  kind: PartnerCardKind;
  revealed: boolean;
}

export interface PartnerMissionSignal {
  word: string;
  count: number;
}

export interface LockedPartnerGuesses {
  turnNumber: number;
  cardIds: string[];
  fieldNote: string | null;
}

export type PartnerTurnStopReason =
  | "guesses_exhausted"
  | "decoy"
  | "trap"
  | "targets_complete";

export interface PartnerReveal {
  cardId: string;
  result: PartnerCardKind;
}

/** A single bounded debrief; Partner Mission deliberately is not event-sourced. */
export interface PartnerPreviousTurn {
  turnNumber: number;
  signal: PartnerMissionSignal;
  lockedCardIds: string[];
  reveals: PartnerReveal[];
  stoppedBy: PartnerTurnStopReason;
  fieldNote: string | null;
}

export interface PartnerMissionState {
  mode: "partner";
  roomId: string;
  lang: Lang;
  phase: PartnerMissionPhase;
  board: PartnerMissionCard[];
  missionLead: PartnerMissionPlayer;
  fieldAgent: PartnerMissionPlayer | null;
  signal: PartnerMissionSignal | null;
  lockedGuesses: LockedPartnerGuesses | null;
  previousTurn: PartnerPreviousTurn | null;
  turnNumber: number;
}

export interface PartnerMissionConfig {
  roomId: string;
  lang: Lang;
  missionLeadId: string;
  missionLeadName: string;
  concepts: Concept[];
  seed: number;
  /**
   * Optional secret, independently shuffled classifications in final board
   * order. Production supplies this from server-side cryptographic randomness;
   * the seeded fallback exists only for deterministic local/test play.
   */
  kinds?: PartnerCardKind[];
}

export type PartnerMissionAction =
  | { type: "claimFieldAgent"; name: string }
  | { type: "giveSignal"; word: string; count: number }
  | {
      type: "lockGuesses";
      cardIds: string[];
      fieldNote?: string;
    }
  | { type: "resolveLockedGuesses" };

export interface PartnerLeadCard {
  id: string;
  concept: Concept;
  revealed: boolean;
  kind: PartnerCardKind;
}

export type PartnerFieldCard =
  | {
      id: string;
      concept: Concept;
      revealed: false;
    }
  | {
      id: string;
      concept: Concept;
      revealed: true;
      result: PartnerCardKind;
    };

export interface PartnerMissionCapabilities {
  claimFieldAgent: boolean;
  giveSignal: boolean;
  lockGuesses: boolean;
  resolveLockedGuesses: boolean;
}

interface PartnerMissionViewBase {
  roomId: string;
  lang: Lang;
  phase: PartnerMissionPhase;
  missionLeadName: string;
  fieldAgentName: string | null;
  targetsRemaining: number;
  signal: PartnerMissionSignal | null;
  lockedCardIds: string[];
  previousTurn: PartnerPreviousTurn | null;
  turnNumber: number;
  can: PartnerMissionCapabilities;
}

export interface PartnerMissionLeadView extends PartnerMissionViewBase {
  viewerRole: "mission_lead";
  board: PartnerLeadCard[];
  maxGuesses: number | null;
}

export interface PartnerFieldAgentView extends PartnerMissionViewBase {
  viewerRole: "field_agent";
  board: PartnerFieldCard[];
  maxGuesses: number | null;
}

/** Safe pre-claim projection: it intentionally carries no board or Signal. */
export interface PartnerMissionOnboardingView {
  roomId: string;
  lang: Lang;
  phase: PartnerMissionPhase;
  viewerRole: null;
  missionLeadName: string;
  fieldAgentName: string | null;
  seatAvailable: boolean;
  can: PartnerMissionCapabilities;
}

export type PartnerMissionView =
  | PartnerMissionLeadView
  | PartnerFieldAgentView
  | PartnerMissionOnboardingView;
