import type { Clue, Lang } from "../engine/index.js";
import { partnerRoleFor } from "../engine/partnerMission/index.js";
import type { SharedRoomRecord } from "./types.js";

export type HintTeam = "red" | "blue" | "partner";

export interface TeamHint {
  turnId: string;
  clue: Clue;
  scores: Record<string, number>;
}

export interface HintView {
  used: boolean;
  canRequest: boolean;
  turnId: string | null;
  scores: Record<string, number> | null;
}

/** Explicit allowlist: no hidden kind, target, identity, roster, or field note. */
export interface HintContext {
  team: HintTeam;
  turnId: string;
  lang: Lang;
  clue: Clue;
  board: Array<{ id: string; word: string; revealed: boolean }>;
}

export type HintErrorCode =
  | "HINT_WRONG_ROLE"
  | "HINT_NOT_AVAILABLE"
  | "HINT_ALREADY_USED"
  | "HINT_STALE"
  | "HINT_INVALID_RESPONSE"
  | "HINT_NOT_CONFIGURED"
  | "HINT_PROVIDER_FAILED"
  | "HINT_TIMEOUT";

export class HintError extends Error {
  readonly code: HintErrorCode;

  constructor(code: HintErrorCode) {
    super(code);
    this.name = "HintError";
    this.code = code;
  }
}

function hintTeamFor(
  room: SharedRoomRecord,
  playerId: string,
): HintTeam | null {
  if (room.mode === "partner") {
    return partnerRoleFor(room.state, playerId) === "field_agent"
      ? "partner"
      : null;
  }
  const player = room.state.players[playerId];
  return player?.role === "operative" ? player.team : null;
}

function currentHintTurn(room: SharedRoomRecord): string | null {
  if (room.mode === "partner") {
    return room.state.phase === "field_agent_turn" && room.state.signal
      ? `partner:${room.state.turnNumber}`
      : null;
  }
  if (room.state.phase !== "guess" || !room.state.clue) return null;
  // Clue IDs include the monotonically increasing room version, so replaying
  // the same clue or restarting with the same board cannot revive old scores.
  const lastClue = room.ui.clueLog.at(-1);
  return `classic:${room.state.turn}:${lastClue?.id ?? "legacy"}:${JSON.stringify(room.state.clue)}`;
}

export function hintViewFor(
  room: SharedRoomRecord,
  playerId: string,
): HintView | undefined {
  const team = hintTeamFor(room, playerId);
  if (!team) return undefined;
  const stored = room.ui.hints?.[team];
  const turnId = currentHintTurn(room);
  const onTurn = room.mode === "partner" || room.state.turn === team;
  return {
    used: Boolean(stored),
    canRequest: !stored && onTurn && turnId !== null,
    turnId: onTurn ? turnId : null,
    scores:
      onTurn && turnId !== null && stored?.turnId === turnId
        ? { ...stored.scores }
        : null,
  };
}

export function prepareHintRequest(
  room: SharedRoomRecord,
  playerId: string,
): HintContext {
  const team = hintTeamFor(room, playerId);
  if (!team) throw new HintError("HINT_WRONG_ROLE");
  const turnId = currentHintTurn(room);
  if (!turnId || (room.mode !== "partner" && room.state.turn !== team)) {
    throw new HintError("HINT_NOT_AVAILABLE");
  }
  const prior = room.ui.hints?.[team];
  if (prior && prior.turnId !== turnId)
    throw new HintError("HINT_ALREADY_USED");
  const clue = room.mode === "partner" ? room.state.signal! : room.state.clue!;
  return {
    team,
    turnId,
    lang: room.state.lang,
    clue: { word: clue.word, count: clue.count },
    board: room.state.board.map((card) => ({
      id: "id" in card ? card.id : card.concept.id,
      word: card.concept[room.state.lang],
      revealed: card.revealed,
    })),
  };
}

export function validateHintScores(
  context: HintContext,
  scores: unknown,
): asserts scores is Record<string, number> {
  const expectedIds = context.board
    .filter((card) => !card.revealed)
    .map((card) => card.id);
  if (
    !scores ||
    typeof scores !== "object" ||
    Array.isArray(scores) ||
    Object.keys(scores).length !== expectedIds.length ||
    expectedIds.some((id) => {
      const value = (scores as Record<string, unknown>)[id];
      return (
        !Object.hasOwn(scores, id) ||
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 1
      );
    })
  )
    throw new HintError("HINT_INVALID_RESPONSE");
}

export function applyTeamHint<T extends SharedRoomRecord>(
  room: T,
  playerId: string,
  context: HintContext,
  scores: Record<string, number>,
  now: string,
): T {
  let current: HintContext;
  try {
    current = prepareHintRequest(room, playerId);
  } catch (error) {
    if (error instanceof HintError && error.code !== "HINT_WRONG_ROLE") {
      throw new HintError("HINT_STALE");
    }
    throw error;
  }
  if (current.team !== context.team || current.turnId !== context.turnId) {
    throw new HintError("HINT_STALE");
  }
  // A concurrent teammate's successful result wins without overwriting it.
  if (room.ui.hints?.[context.team]) return room;
  if (JSON.stringify(current) !== JSON.stringify(context)) {
    throw new HintError("HINT_STALE");
  }
  validateHintScores(context, scores);
  return {
    ...room,
    ui: {
      ...room.ui,
      hints: {
        ...room.ui.hints,
        [context.team]: {
          turnId: context.turnId,
          clue: context.clue,
          scores: { ...scores },
        },
      },
    },
    version: room.version + 1,
    updatedAt: now,
  };
}
