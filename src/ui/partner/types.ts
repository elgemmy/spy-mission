import type { CardLang } from "../card";

export type PartnerMissionPhase =
  | "waiting_for_agent"
  | "waiting_for_signal"
  | "field_agent_turn"
  | "locked"
  | "won"
  | "lost";

export type PartnerCardKind = "target" | "decoy" | "trap";

export interface PartnerSignal {
  word: string;
  count: number;
}

interface PartnerCardBase {
  id: string;
  word: string;
}

/**
 * A Mission Lead projection. This is the only UI card shape that can contain
 * an unrevealed classification.
 */
export interface MissionLeadCard extends PartnerCardBase {
  kind: PartnerCardKind;
  revealed: boolean;
}

/**
 * A Field Agent projection. Unrevealed classifications are structurally
 * impossible to express; public results exist only after reveal.
 */
export type FieldAgentCard =
  | (PartnerCardBase & {
      revealed: false;
      result?: never;
    })
  | (PartnerCardBase & {
      revealed: true;
      result: PartnerCardKind;
    });

export interface PartnerRevealResult {
  cardId: string;
  word: string;
  result: PartnerCardKind;
}

export interface PartnerPreviousTurn {
  signal: PartnerSignal;
  reveals: readonly PartnerRevealResult[];
  fieldNote?: string;
}

export interface PartnerRevealPresentation {
  countdownSeconds?: number;
  activeCardId?: string;
  /** Ordered IDs from the authoritative resolved turn. */
  sequenceCardIds?: readonly string[];
  /** Number of sequence cards that the presentation may show as revealed. */
  visibleRevealCount?: number;
  step?: {
    current: number;
    total: number;
  };
}

export type WebMcpCapability =
  | { state: "checking"; toolCount: 0 }
  | { state: "unavailable"; toolCount: 0 }
  | { state: "error"; toolCount: 0 }
  | { state: "ready"; toolCount: number };

export interface PartnerMissionCommonProps {
  locale: "en" | "ar";
  boardLang: CardLang;
  phase: PartnerMissionPhase;
  targetsRemaining: number;
  fieldAgentName: string | null;
  signal: PartnerSignal | null;
  lockedCardIds: readonly string[];
  previousTurn?: PartnerPreviousTurn | null;
  presentation?: PartnerRevealPresentation;
}
