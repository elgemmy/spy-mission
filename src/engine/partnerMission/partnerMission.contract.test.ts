// @vitest-environment node

import { describe, expect, it } from "vitest";
import { IllegalMove } from "../contract.js";
import type { Concept } from "../codenames/types.js";
import {
  initialPartnerMissionState,
  partnerMissionReducer,
  partnerMissionViewFor,
  type PartnerCardKind,
  type PartnerMissionState,
} from "./index.js";

const LEAD_ID = "lead-user-id";
const AGENT_ID = "agent-user-id";

function concepts(): Concept[] {
  return Array.from({ length: 25 }, (_, index) => ({
    id: `c${String(index + 1).padStart(2, "0")}`,
    en: `Word ${index + 1}`,
    ar: `كلمة ${index + 1}`,
  }));
}

function fresh(seed = 42): PartnerMissionState {
  return initialPartnerMissionState({
    roomId: "room-id",
    lang: "en",
    missionLeadId: LEAD_ID,
    missionLeadName: "  Lead  ",
    concepts: concepts(),
    seed,
  });
}

function withAgent(seed = 42): PartnerMissionState {
  return partnerMissionReducer(
    fresh(seed),
    { type: "claimFieldAgent", name: "  Cipher  " },
    AGENT_ID,
  );
}

function withSignal(count = 2, seed = 42): PartnerMissionState {
  return partnerMissionReducer(
    withAgent(seed),
    { type: "giveSignal", word: "  orbit  ", count },
    LEAD_ID,
  );
}

function idsOfKind(
  state: PartnerMissionState,
  kind: PartnerCardKind,
): string[] {
  return state.board.filter((card) => card.kind === kind).map(({ id }) => id);
}

function expectCode(fn: () => unknown, code: string): void {
  expect(fn).toThrowError(
    expect.objectContaining({ code }) satisfies Partial<IllegalMove>,
  );
}

describe("Partner Mission creation and seat", () => {
  it("creates a dealt private-mode aggregate with its creator as Mission Lead", () => {
    const state = fresh();

    expect(state).toMatchObject({
      mode: "partner",
      phase: "waiting_for_agent",
      missionLead: { id: LEAD_ID, name: "Lead" },
      fieldAgent: null,
      signal: null,
      previousTurn: null,
    });
    expect(state.board).toHaveLength(25);
    expect(state.board.every((card) => !card.revealed)).toBe(true);
  });

  it("deals deterministic 8/16/1 boards with stable non-index card IDs", () => {
    const first = fresh(123);
    const repeat = fresh(123);
    const other = fresh(124);

    expect(first.board).toEqual(repeat.board);
    expect(first.board).not.toEqual(other.board);
    expect(idsOfKind(first, "target")).toHaveLength(8);
    expect(idsOfKind(first, "decoy")).toHaveLength(16);
    expect(idsOfKind(first, "trap")).toHaveLength(1);
    expect(new Set(first.board.map(({ id }) => id))).toEqual(
      new Set(concepts().map(({ id }) => id)),
    );
  });

  it("accepts independently shuffled server classifications in final board order", () => {
    const kinds: PartnerCardKind[] = [
      "trap",
      ...Array<PartnerCardKind>(8).fill("target"),
      ...Array<PartnerCardKind>(16).fill("decoy"),
    ];
    const state = initialPartnerMissionState({
      roomId: "room-id",
      lang: "en",
      missionLeadId: LEAD_ID,
      missionLeadName: "Lead",
      concepts: concepts(),
      seed: 123,
      kinds,
    });

    expect(state.board.map(({ kind }) => kind)).toEqual(kinds);
    expect(state.board.map(({ id }) => id)).not.toEqual(
      concepts().map(({ id }) => id),
    );
    kinds[0] = "decoy";
    expect(state.board[0]?.kind).toBe("trap");
  });

  it("rejects malformed server-provided classification arrays", () => {
    const valid: PartnerCardKind[] = [
      ...Array<PartnerCardKind>(8).fill("target"),
      ...Array<PartnerCardKind>(16).fill("decoy"),
      "trap",
    ];
    const config = {
      roomId: "room-id",
      lang: "en" as const,
      missionLeadId: LEAD_ID,
      missionLeadName: "Lead",
      concepts: concepts(),
      seed: 1,
    };

    expectCode(
      () =>
        initialPartnerMissionState({
          ...config,
          kinds: valid.slice(1),
        }),
      "BAD_DEAL",
    );
    expectCode(
      () =>
        initialPartnerMissionState({
          ...config,
          kinds: valid.map((kind, index) => (index === 0 ? "decoy" : kind)),
        }),
      "BAD_DEAL",
    );
    expectCode(
      () =>
        initialPartnerMissionState({
          ...config,
          kinds: valid.map((kind, index) =>
            index === 0 ? ("classified" as PartnerCardKind) : kind,
          ),
        }),
      "BAD_DEAL",
    );
  });

  it("rejects malformed deals, including duplicate stable IDs", () => {
    const base = {
      roomId: "room-id",
      lang: "en" as const,
      missionLeadId: LEAD_ID,
      missionLeadName: "Lead",
      seed: 1,
    };
    expectCode(
      () =>
        initialPartnerMissionState({ ...base, concepts: concepts().slice(1) }),
      "BAD_DEAL",
    );
    const duplicateIds = concepts();
    duplicateIds[1] = { ...duplicateIds[1]!, id: duplicateIds[0]!.id };
    expectCode(
      () => initialPartnerMissionState({ ...base, concepts: duplicateIds }),
      "BAD_DEAL",
    );
  });

  it("binds the first Field Agent identity, not the display name", () => {
    const claimed = withAgent();

    expect(claimed).toMatchObject({
      phase: "waiting_for_signal",
      fieldAgent: { id: AGENT_ID, name: "Cipher" },
    });
    expectCode(
      () =>
        partnerMissionReducer(
          claimed,
          { type: "claimFieldAgent", name: "Cipher" },
          "second-identity",
        ),
      "FIELD_AGENT_SEAT_TAKEN",
    );
  });

  it("allows the owning Field Agent identity to resume idempotently", () => {
    const claimed = withAgent();
    expect(
      partnerMissionReducer(
        claimed,
        { type: "claimFieldAgent", name: "Changed label" },
        AGENT_ID,
      ),
    ).toBe(claimed);
  });

  it("does not allow the Mission Lead to claim the agent seat", () => {
    expectCode(
      () =>
        partnerMissionReducer(
          fresh(),
          { type: "claimFieldAgent", name: "Double Agent" },
          LEAD_ID,
        ),
      "WRONG_ROLE",
    );
  });
});

describe("Partner Mission Signal and lock", () => {
  it.each([1, 8])("accepts boundary Signal count %s", (count) => {
    const state = withAgent();
    const next = partnerMissionReducer(
      state,
      { type: "giveSignal", word: "orbit", count },
      LEAD_ID,
    );
    expect(next).toMatchObject({
      phase: "field_agent_turn",
      signal: { word: "orbit", count },
      turnNumber: 1,
    });
  });

  it.each([
    { word: "", count: 1 },
    { word: "two words", count: 1 },
    { word: "orbit", count: 0 },
    { word: "orbit", count: 9 },
    { word: "orbit", count: 1.5 },
    { word: "x".repeat(41), count: 1 },
  ])("rejects invalid Signal $word/$count", ({ word, count }) => {
    expectCode(
      () =>
        partnerMissionReducer(
          withAgent(),
          { type: "giveSignal", word, count },
          LEAD_ID,
        ),
      "INVALID_SIGNAL",
    );
  });

  it("locks 1 through N+1 ordered stable IDs and preserves their order", () => {
    const state = withSignal(2);
    const ids = state.board.slice(0, 3).map(({ id }) => id);
    const one = partnerMissionReducer(
      state,
      { type: "lockGuesses", cardIds: ids.slice(0, 1) },
      AGENT_ID,
    );
    const max = partnerMissionReducer(
      state,
      { type: "lockGuesses", cardIds: ids, fieldNote: "  strongest first  " },
      AGENT_ID,
    );

    expect(one.lockedGuesses?.cardIds).toEqual(ids.slice(0, 1));
    expect(max).toMatchObject({
      phase: "locked",
      lockedGuesses: {
        turnNumber: 1,
        cardIds: ids,
        fieldNote: "strongest first",
      },
    });
  });

  it("rejects empty, excessive, duplicate, unknown, and already revealed IDs", () => {
    const state = withSignal(1);
    const [first, second, third] = state.board.map(({ id }) => id);

    expectCode(
      () =>
        partnerMissionReducer(
          state,
          { type: "lockGuesses", cardIds: [] },
          AGENT_ID,
        ),
      "INVALID_GUESS_COUNT",
    );
    expectCode(
      () =>
        partnerMissionReducer(
          state,
          { type: "lockGuesses", cardIds: [first!, second!, third!] },
          AGENT_ID,
        ),
      "INVALID_GUESS_COUNT",
    );
    expectCode(
      () =>
        partnerMissionReducer(
          state,
          { type: "lockGuesses", cardIds: [first!, first!] },
          AGENT_ID,
        ),
      "DUPLICATE_CARD",
    );
    expectCode(
      () =>
        partnerMissionReducer(
          state,
          { type: "lockGuesses", cardIds: ["missing"] },
          AGENT_ID,
        ),
      "CARD_NOT_FOUND",
    );
    const revealed: PartnerMissionState = {
      ...state,
      board: state.board.map((card) =>
        card.id === first ? { ...card, revealed: true } : card,
      ),
    };
    expectCode(
      () =>
        partnerMissionReducer(
          revealed,
          { type: "lockGuesses", cardIds: [first!] },
          AGENT_ID,
        ),
      "CARD_ALREADY_REVEALED",
    );
  });

  it("rejects a repeated submission and notes over 160 characters", () => {
    const state = withSignal(2);
    const ids = state.board.slice(0, 2).map(({ id }) => id);
    const locked = partnerMissionReducer(
      state,
      { type: "lockGuesses", cardIds: ids },
      AGENT_ID,
    );

    expectCode(
      () =>
        partnerMissionReducer(
          locked,
          { type: "lockGuesses", cardIds: ids },
          AGENT_ID,
        ),
      "WRONG_PHASE",
    );
    expectCode(
      () =>
        partnerMissionReducer(
          state,
          { type: "lockGuesses", cardIds: ids, fieldNote: "x".repeat(161) },
          AGENT_ID,
        ),
      "FIELD_NOTE_TOO_LONG",
    );
  });
});

describe("Partner Mission ordered resolution", () => {
  it("reveals Targets in order and ends a surviving exhausted lock", () => {
    const signaled = withSignal(2);
    const ids = idsOfKind(signaled, "target").slice(0, 3);
    const locked = partnerMissionReducer(
      signaled,
      { type: "lockGuesses", cardIds: ids, fieldNote: "cluster" },
      AGENT_ID,
    );
    const resolved = partnerMissionReducer(
      locked,
      { type: "resolveLockedGuesses" },
      LEAD_ID,
    );

    expect(resolved.phase).toBe("waiting_for_signal");
    expect(resolved.previousTurn).toEqual({
      turnNumber: 1,
      signal: { word: "orbit", count: 2 },
      lockedCardIds: ids,
      reveals: ids.map((cardId) => ({ cardId, result: "target" })),
      stoppedBy: "guesses_exhausted",
      fieldNote: "cluster",
    });
    expect(
      ids.map((id) => resolved.board.find((card) => card.id === id)?.revealed),
    ).toEqual([true, true, true]);
  });

  it("short-circuits at a Decoy and leaves later locked IDs unrevealed", () => {
    const signaled = withSignal(2);
    const target = idsOfKind(signaled, "target")[0]!;
    const decoy = idsOfKind(signaled, "decoy")[0]!;
    const untouched = idsOfKind(signaled, "target")[1]!;
    const locked = partnerMissionReducer(
      signaled,
      { type: "lockGuesses", cardIds: [target, decoy, untouched] },
      AGENT_ID,
    );
    const resolved = partnerMissionReducer(
      locked,
      { type: "resolveLockedGuesses" },
      LEAD_ID,
    );

    expect(resolved.phase).toBe("waiting_for_signal");
    expect(resolved.previousTurn?.reveals).toEqual([
      { cardId: target, result: "target" },
      { cardId: decoy, result: "decoy" },
    ]);
    expect(resolved.previousTurn?.stoppedBy).toBe("decoy");
    expect(resolved.board.find(({ id }) => id === untouched)?.revealed).toBe(
      false,
    );
  });

  it("short-circuits at the Trap and loses", () => {
    const signaled = withSignal(2);
    const trap = idsOfKind(signaled, "trap")[0]!;
    const untouched = idsOfKind(signaled, "target")[0]!;
    const locked = partnerMissionReducer(
      signaled,
      { type: "lockGuesses", cardIds: [trap, untouched] },
      AGENT_ID,
    );
    const resolved = partnerMissionReducer(
      locked,
      { type: "resolveLockedGuesses" },
      LEAD_ID,
    );

    expect(resolved.phase).toBe("lost");
    expect(resolved.previousTurn?.reveals).toEqual([
      { cardId: trap, result: "trap" },
    ]);
    expect(resolved.board.find(({ id }) => id === untouched)?.revealed).toBe(
      false,
    );
  });

  it("wins immediately on the eighth Target", () => {
    const signaled = withSignal(1);
    const allTargets = idsOfKind(signaled, "target");
    const finalTarget = allTargets.at(-1)!;
    const oneLeft: PartnerMissionState = {
      ...signaled,
      board: signaled.board.map((card) =>
        card.kind === "target" && card.id !== finalTarget
          ? { ...card, revealed: true }
          : card,
      ),
    };
    const locked = partnerMissionReducer(
      oneLeft,
      { type: "lockGuesses", cardIds: [finalTarget] },
      AGENT_ID,
    );
    const won = partnerMissionReducer(
      locked,
      { type: "resolveLockedGuesses" },
      LEAD_ID,
    );

    expect(won.phase).toBe("won");
    expect(won.previousTurn?.stoppedBy).toBe("targets_complete");
  });

  it("loops a surviving mission to another Signal and bounds debrief to one turn", () => {
    const firstSignal = withSignal(1);
    const firstTarget = idsOfKind(firstSignal, "target")[0]!;
    const firstResolution = partnerMissionReducer(
      partnerMissionReducer(
        firstSignal,
        { type: "lockGuesses", cardIds: [firstTarget] },
        AGENT_ID,
      ),
      { type: "resolveLockedGuesses" },
      LEAD_ID,
    );
    const secondSignal = partnerMissionReducer(
      firstResolution,
      { type: "giveSignal", word: "space", count: 1 },
      LEAD_ID,
    );
    const decoy = idsOfKind(secondSignal, "decoy")[0]!;
    const secondResolution = partnerMissionReducer(
      partnerMissionReducer(
        secondSignal,
        { type: "lockGuesses", cardIds: [decoy] },
        AGENT_ID,
      ),
      { type: "resolveLockedGuesses" },
      LEAD_ID,
    );

    expect(secondSignal.turnNumber).toBe(2);
    expect(secondResolution.phase).toBe("waiting_for_signal");
    expect(secondResolution.previousTurn?.turnNumber).toBe(2);
    expect(secondResolution.previousTurn?.signal.word).toBe("space");
  });

  it("treats a retry of the latest completed resolution as idempotent", () => {
    const signaled = withSignal(1);
    const target = idsOfKind(signaled, "target")[0]!;
    const resolved = partnerMissionReducer(
      partnerMissionReducer(
        signaled,
        { type: "lockGuesses", cardIds: [target] },
        AGENT_ID,
      ),
      { type: "resolveLockedGuesses" },
      LEAD_ID,
    );

    expect(
      partnerMissionReducer(
        resolved,
        { type: "resolveLockedGuesses" },
        LEAD_ID,
      ),
    ).toBe(resolved);
  });
});

describe("Partner Mission projections", () => {
  it("gives the Mission Lead the complete secret map", () => {
    const state = withAgent();
    const view = partnerMissionViewFor(state, LEAD_ID);
    if (view.viewerRole !== "mission_lead") {
      throw new Error("expected Mission Lead view");
    }

    expect(view.board).toHaveLength(25);
    expect(view.board.every((card) => typeof card.kind === "string")).toBe(
      true,
    );
  });

  it("omits classification properties completely from every unrevealed Field Agent card", () => {
    const state = withAgent();
    const view = partnerMissionViewFor(state, AGENT_ID);
    if (view.viewerRole !== "field_agent") {
      throw new Error("expected Field Agent view");
    }

    for (const card of view.board) {
      expect(card.revealed).toBe(false);
      expect(Object.hasOwn(card, "kind")).toBe(false);
      expect(Object.hasOwn(card, "result")).toBe(false);
    }
  });

  it("reveals results only for revealed cards and never leaks unprocessed locked cards", () => {
    const signaled = withSignal(2);
    const target = idsOfKind(signaled, "target")[0]!;
    const decoy = idsOfKind(signaled, "decoy")[0]!;
    const unrevealedTarget = idsOfKind(signaled, "target")[1]!;
    const resolved = partnerMissionReducer(
      partnerMissionReducer(
        signaled,
        {
          type: "lockGuesses",
          cardIds: [target, decoy, unrevealedTarget],
          fieldNote: "maybe a cluster",
        },
        AGENT_ID,
      ),
      { type: "resolveLockedGuesses" },
      LEAD_ID,
    );
    const view = partnerMissionViewFor(resolved, AGENT_ID);
    if (view.viewerRole !== "field_agent") {
      throw new Error("expected Field Agent view");
    }

    expect(view.board.find(({ id }) => id === target)).toMatchObject({
      revealed: true,
      result: "target",
    });
    expect(view.board.find(({ id }) => id === decoy)).toMatchObject({
      revealed: true,
      result: "decoy",
    });
    const untouched = view.board.find(({ id }) => id === unrevealedTarget)!;
    expect(untouched).toEqual(
      expect.objectContaining({ id: unrevealedTarget, revealed: false }),
    );
    expect(Object.hasOwn(untouched, "kind")).toBe(false);
    expect(Object.hasOwn(untouched, "result")).toBe(false);
  });

  it("does not expose a field note before resolution, then includes it in the debrief", () => {
    const signaled = withSignal(1);
    const target = idsOfKind(signaled, "target")[0]!;
    const locked = partnerMissionReducer(
      signaled,
      { type: "lockGuesses", cardIds: [target], fieldNote: "cluster" },
      AGENT_ID,
    );
    const leadLocked = partnerMissionViewFor(locked, LEAD_ID);
    const fieldLocked = partnerMissionViewFor(locked, AGENT_ID);

    expect(JSON.stringify(leadLocked)).not.toContain("cluster");
    expect(JSON.stringify(fieldLocked)).not.toContain("cluster");

    const resolved = partnerMissionReducer(
      locked,
      { type: "resolveLockedGuesses" },
      LEAD_ID,
    );
    expect(partnerMissionViewFor(resolved, AGENT_ID)).toMatchObject({
      previousTurn: { fieldNote: "cluster" },
    });
  });

  it("returns a board-free onboarding projection to an unclaimed identity", () => {
    const view = partnerMissionViewFor(fresh(), "invited-user");
    expect(view).toEqual({
      roomId: "room-id",
      lang: "en",
      phase: "waiting_for_agent",
      viewerRole: null,
      missionLeadName: "Lead",
      fieldAgentName: null,
      seatAvailable: true,
      can: {
        claimFieldAgent: true,
        giveSignal: false,
        lockGuesses: false,
        resolveLockedGuesses: false,
      },
    });
    expect(Object.hasOwn(view, "board")).toBe(false);
  });

  it("keeps state and every role projection JSON-serializable", () => {
    const state = withSignal();
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(
      JSON.parse(JSON.stringify(partnerMissionViewFor(state, LEAD_ID))),
    ).toEqual(partnerMissionViewFor(state, LEAD_ID));
    expect(
      JSON.parse(JSON.stringify(partnerMissionViewFor(state, AGENT_ID))),
    ).toEqual(partnerMissionViewFor(state, AGENT_ID));
  });
});
