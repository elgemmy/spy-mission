import { IllegalMove } from "../contract.js";
import { normalizePartnerName } from "./initialState.js";
import {
  PARTNER_MAX_FIELD_NOTE_LENGTH,
  PARTNER_MAX_SIGNAL_COUNT,
  PARTNER_MAX_SIGNAL_LENGTH,
  PARTNER_MIN_SIGNAL_COUNT,
  type PartnerMissionAction,
  type PartnerMissionCard,
  type PartnerMissionSignal,
  type PartnerMissionState,
  type PartnerReveal,
  type PartnerTurnStopReason,
} from "./types.js";

function assertMissionLead(state: PartnerMissionState, actorId: string): void {
  if (state.missionLead.id !== actorId) {
    throw new IllegalMove("WRONG_ROLE");
  }
}

function assertFieldAgent(state: PartnerMissionState, actorId: string): void {
  if (!state.fieldAgent) {
    throw new IllegalMove("NOT_A_PLAYER");
  }
  if (state.fieldAgent.id !== actorId) {
    throw new IllegalMove("WRONG_ROLE");
  }
}

function normalizeSignal(word: string, count: number): PartnerMissionSignal {
  const normalizedWord = word.trim();
  if (
    normalizedWord.length === 0 ||
    normalizedWord.length > PARTNER_MAX_SIGNAL_LENGTH ||
    /\s/u.test(normalizedWord) ||
    !Number.isInteger(count) ||
    count < PARTNER_MIN_SIGNAL_COUNT ||
    count > PARTNER_MAX_SIGNAL_COUNT
  ) {
    throw new IllegalMove("INVALID_SIGNAL");
  }
  return { word: normalizedWord, count };
}

function normalizeFieldNote(fieldNote: string | undefined): string | null {
  if (fieldNote === undefined) {
    return null;
  }
  const normalized = fieldNote.trim();
  if (normalized.length > PARTNER_MAX_FIELD_NOTE_LENGTH) {
    throw new IllegalMove("FIELD_NOTE_TOO_LONG");
  }
  return normalized.length === 0 ? null : normalized;
}

function remainingTargets(board: PartnerMissionCard[]): number {
  return board.filter((card) => card.kind === "target" && !card.revealed)
    .length;
}

function resolveLocked(state: PartnerMissionState): PartnerMissionState {
  const locked = state.lockedGuesses;
  const signal = state.signal;
  if (!locked || !signal) {
    throw new IllegalMove("WRONG_PHASE");
  }

  let board = state.board;
  const reveals: PartnerReveal[] = [];
  let stoppedBy: PartnerTurnStopReason = "guesses_exhausted";
  let phase: PartnerMissionState["phase"] = "waiting_for_signal";

  for (const cardId of locked.cardIds) {
    const target = board.find((card) => card.id === cardId);
    // Locks validate these invariants. Failing closed protects corrupted state.
    if (!target || target.revealed) {
      throw new IllegalMove(
        target ? "CARD_ALREADY_REVEALED" : "CARD_NOT_FOUND",
      );
    }

    board = board.map((card) =>
      card.id === cardId ? { ...card, revealed: true } : card,
    );
    reveals.push({ cardId, result: target.kind });

    if (target.kind === "trap") {
      stoppedBy = "trap";
      phase = "lost";
      break;
    }
    if (target.kind === "decoy") {
      stoppedBy = "decoy";
      break;
    }
    if (remainingTargets(board) === 0) {
      stoppedBy = "targets_complete";
      phase = "won";
      break;
    }
  }

  return {
    ...state,
    board,
    phase,
    signal: null,
    lockedGuesses: null,
    previousTurn: {
      turnNumber: locked.turnNumber,
      signal,
      lockedCardIds: [...locked.cardIds],
      reveals,
      stoppedBy,
      fieldNote: locked.fieldNote,
    },
  };
}

export function partnerMissionReducer(
  state: PartnerMissionState,
  action: PartnerMissionAction,
  actorId: string,
): PartnerMissionState {
  switch (action.type) {
    case "claimFieldAgent": {
      if (actorId === state.missionLead.id) {
        throw new IllegalMove("WRONG_ROLE");
      }
      if (state.fieldAgent) {
        if (state.fieldAgent.id === actorId) {
          return state;
        }
        throw new IllegalMove("FIELD_AGENT_SEAT_TAKEN");
      }
      if (state.phase !== "waiting_for_agent") {
        throw new IllegalMove("WRONG_PHASE");
      }
      return {
        ...state,
        phase: "waiting_for_signal",
        fieldAgent: {
          id: actorId,
          name: normalizePartnerName(action.name),
        },
      };
    }

    case "giveSignal": {
      assertMissionLead(state, actorId);
      if (state.phase !== "waiting_for_signal") {
        throw new IllegalMove("WRONG_PHASE");
      }
      const signal = normalizeSignal(action.word, action.count);
      return {
        ...state,
        phase: "field_agent_turn",
        signal,
        lockedGuesses: null,
        turnNumber: state.turnNumber + 1,
      };
    }

    case "lockGuesses": {
      assertFieldAgent(state, actorId);
      if (state.phase !== "field_agent_turn" || !state.signal) {
        throw new IllegalMove("WRONG_PHASE");
      }
      const maxGuesses = state.signal.count + 1;
      if (action.cardIds.length < 1 || action.cardIds.length > maxGuesses) {
        throw new IllegalMove("INVALID_GUESS_COUNT");
      }
      if (new Set(action.cardIds).size !== action.cardIds.length) {
        throw new IllegalMove("DUPLICATE_CARD");
      }
      for (const cardId of action.cardIds) {
        const card = state.board.find((candidate) => candidate.id === cardId);
        if (!card) {
          throw new IllegalMove("CARD_NOT_FOUND");
        }
        if (card.revealed) {
          throw new IllegalMove("CARD_ALREADY_REVEALED");
        }
      }

      return {
        ...state,
        phase: "locked",
        lockedGuesses: {
          turnNumber: state.turnNumber,
          cardIds: [...action.cardIds],
          fieldNote: normalizeFieldNote(action.fieldNote),
        },
      };
    }

    case "resolveLockedGuesses": {
      assertMissionLead(state, actorId);
      if (state.phase === "locked") {
        return resolveLocked(state);
      }
      // Retried resolution of the most recently completed lock is harmless.
      if (
        (state.phase === "waiting_for_signal" ||
          state.phase === "won" ||
          state.phase === "lost") &&
        state.previousTurn?.turnNumber === state.turnNumber
      ) {
        return state;
      }
      throw new IllegalMove("WRONG_PHASE");
    }

    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
