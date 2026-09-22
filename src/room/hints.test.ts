import { describe, expect, it } from "vitest";
import { makeConcepts, startTestGame } from "../engine/codenames/testFixtures";
import { applyRoomCommand } from "./commands";
import { applyPartnerRoomAction, createPartnerRoomRecord } from "./partner";
import { applyTeamHint, hintViewFor, prepareHintRequest } from "./hints";
import { toRoomSnapshot } from "./snapshot";
import { normalizeRoomUi } from "./uiState";
import type { PartnerRoomRecord, RoomRecord } from "./types";

const NOW = "2026-09-22T12:00:00.000Z";

export function classicHintRoom(): RoomRecord {
  const state = startTestGame();
  const room: RoomRecord = {
    id: state.roomId,
    code: "CLASSIC",
    hostId: "p-red-sm",
    visibility: "public",
    state,
    ui: normalizeRoomUi(null),
    version: 8,
    createdAt: NOW,
    updatedAt: NOW,
  };
  return applyRoomCommand(
    room,
    `p-${state.turn}-sm`,
    { type: "giveClue", word: "space", count: 3 },
    NOW,
  );
}

export function partnerHintRoom(
  partnerType: "ai" | "human" = "ai",
): PartnerRoomRecord {
  let room = createPartnerRoomRecord({
    id: "partner-test",
    code: "PARTNER",
    hostId: "lead",
    hostName: "Lead",
    partnerType,
    lang: "en",
    concepts: makeConcepts(),
    seed: 42,
    now: NOW,
  });
  room = applyPartnerRoomAction(
    room,
    "agent",
    { type: "claimFieldAgent", name: "Field" },
    NOW,
  );
  if (partnerType === "human") {
    room = applyPartnerRoomAction(
      room,
      "agent-2",
      { type: "claimFieldAgent", name: "Field 2", role: "field_agent" },
      NOW,
    );
    room = applyPartnerRoomAction(
      room,
      "lead",
      { type: "startPartnerMission" },
      NOW,
    );
  }
  return applyPartnerRoomAction(
    room,
    "lead",
    { type: "giveSignal", word: "space", count: 2 },
    NOW,
  );
}

function scoresFor(room: RoomRecord | PartnerRoomRecord, playerId: string) {
  return Object.fromEntries(
    prepareHintRequest(room, playerId)
      .board.filter((card) => !card.revealed)
      .map((card) => [card.id, 0.75]),
  );
}

describe("team hint lifecycle", () => {
  it("shares a classic hint with same-team operators and keeps the other team private", () => {
    const room = classicHintRoom();
    const actor = `p-${room.state.turn}-op`;
    room.state.players.peer = {
      name: "Peer",
      role: "operative",
      team: room.state.turn,
    };
    const context = prepareHintRequest(room, actor);
    const next = applyTeamHint(
      room,
      actor,
      context,
      scoresFor(room, actor),
      NOW,
    );
    const other = `p-${room.state.turn === "red" ? "blue" : "red"}-op`;

    expect(hintViewFor(next, actor)).toEqual(hintViewFor(next, "peer"));
    expect(hintViewFor(next, actor)).toMatchObject({
      used: true,
      canRequest: false,
      scores: expect.any(Object),
    });
    expect(hintViewFor(next, other)).toEqual({
      used: false,
      canRequest: false,
      turnId: null,
      scores: null,
    });
    expect(toRoomSnapshot(next, actor).ui).not.toHaveProperty("hints");
    expect(toRoomSnapshot(next, `p-${room.state.turn}-sm`)).not.toHaveProperty(
      "hint",
    );
    expect(toRoomSnapshot(next, "outsider")).not.toHaveProperty("hint");
    expect(
      applyTeamHint(next, "peer", context, scoresFor(room, actor), NOW),
    ).toBe(next);
    expect(normalizeRoomUi(next.ui).hints).toEqual(next.ui.hints);
  });

  it("rejects leads, nonmembers, opponents, and requests before a clue", () => {
    const room = classicHintRoom();
    expect(() => prepareHintRequest(room, `p-${room.state.turn}-sm`)).toThrow(
      "HINT_WRONG_ROLE",
    );
    expect(() => prepareHintRequest(room, "outsider")).toThrow(
      "HINT_WRONG_ROLE",
    );
    expect(() =>
      prepareHintRequest(
        room,
        `p-${room.state.turn === "red" ? "blue" : "red"}-op`,
      ),
    ).toThrow("HINT_NOT_AVAILABLE");
    room.state.phase = "clue";
    expect(() => prepareHintRequest(room, `p-${room.state.turn}-op`)).toThrow(
      "HINT_NOT_AVAILABLE",
    );
  });

  it("expires scores when the turn ends but keeps usage spent until a new game", () => {
    const room = classicHintRoom();
    const actor = `p-${room.state.turn}-op`;
    const context = prepareHintRequest(room, actor);
    const used = applyTeamHint(
      room,
      actor,
      context,
      scoresFor(room, actor),
      NOW,
    );
    used.state.guessesMadeThisTurn = 1;
    let next = applyRoomCommand(used, actor, { type: "endTurn" }, NOW);
    expect(hintViewFor(next, actor)).toMatchObject({
      used: true,
      scores: null,
      canRequest: false,
    });
    const other = `p-${next.state.turn}-op`;
    next = applyRoomCommand(
      next,
      `p-${next.state.turn}-sm`,
      { type: "giveClue", word: "space", count: 3 },
      NOW,
    );
    expect(hintViewFor(next, other)?.canRequest).toBe(true);
    next.state.guessesMadeThisTurn = 1;
    next = applyRoomCommand(next, other, { type: "endTurn" }, NOW);
    next = applyRoomCommand(
      next,
      `p-${next.state.turn}-sm`,
      { type: "giveClue", word: "space", count: 3 },
      NOW,
    );
    expect(() => prepareHintRequest(next, actor)).toThrow("HINT_ALREADY_USED");
    next = applyRoomCommand(next, next.hostId, { type: "returnToLobby" }, NOW);
    expect(hintViewFor(next, actor)?.used).toBe(false);
    expect(next.ui.hints).toBeUndefined();
  });

  it("rejects results from a previous game even when its board and clue repeat", () => {
    const room = classicHintRoom();
    const actor = `p-${room.state.turn}-op`;
    const context = prepareHintRequest(room, actor);
    let next = applyRoomCommand(
      room,
      room.hostId,
      { type: "returnToLobby" },
      NOW,
    );
    next = applyRoomCommand(next, next.hostId, { type: "startGame" }, NOW, 42);
    next = applyRoomCommand(
      next,
      `p-${next.state.turn}-sm`,
      { type: "giveClue", word: "space", count: 3 },
      NOW,
    );
    expect(() =>
      applyTeamHint(
        next,
        `p-${next.state.turn}-op`,
        context,
        scoresFor(room, actor),
        NOW,
      ),
    ).toThrow("HINT_STALE");
  });

  it.each(["ai", "human"] as const)(
    "supports %s partner missions with one team allowance",
    (kind) => {
      const room = partnerHintRoom(kind);
      const context = prepareHintRequest(room, "agent");
      const next = applyTeamHint(
        room,
        "agent",
        context,
        scoresFor(room, "agent"),
        NOW,
      );
      expect(hintViewFor(next, "agent")).toMatchObject({
        used: true,
        canRequest: false,
      });
      expect(() => prepareHintRequest(room, "lead")).toThrow("HINT_WRONG_ROLE");
      expect(toRoomSnapshot(next, "lead")).not.toHaveProperty("hint");
      expect(JSON.stringify(context)).not.toMatch(
        /kind|target|missionLead|fieldAgent/,
      );
      expect(Object.keys(next.ui.hints!.partner!.scores)).toEqual(
        room.state.board.map((card) => card.id),
      );
      if (kind === "human") {
        expect(hintViewFor(next, "agent-2")).toEqual(
          hintViewFor(next, "agent"),
        );
        const joined = applyPartnerRoomAction(
          next,
          "late-agent",
          { type: "claimFieldAgent", name: "Late", role: "field_agent" },
          NOW,
        );
        expect(hintViewFor(joined, "late-agent")).toEqual(
          hintViewFor(next, "agent"),
        );
      }
      const locked = applyPartnerRoomAction(
        next,
        "agent",
        { type: "lockGuesses", cardIds: [room.state.board[0]!.id] },
        NOW,
      );
      expect(hintViewFor(locked, "agent")).toMatchObject({
        used: true,
        scores: null,
      });
    },
  );

  it("permits concurrent votes while rejecting a changed board", () => {
    const room = classicHintRoom();
    const actor = `p-${room.state.turn}-op`;
    const context = prepareHintRequest(room, actor);
    const voted = applyRoomCommand(
      room,
      actor,
      { type: "vote", cardIndex: 0 },
      NOW,
    );
    expect(
      applyTeamHint(voted, actor, context, scoresFor(room, actor), NOW).ui
        .votes,
    ).toEqual(voted.ui.votes);
    voted.state = {
      ...voted.state,
      board: voted.state.board.map((card, i) => ({
        ...card,
        revealed: i === 0,
      })),
    };
    expect(() =>
      applyTeamHint(voted, actor, context, scoresFor(room, actor), NOW),
    ).toThrow("HINT_STALE");
  });

  it.each([NaN, Infinity, -0.1, 1.1, "0.8"])(
    "rejects invalid scores (%s) without consuming usage",
    (bad) => {
      const room = classicHintRoom();
      const actor = `p-${room.state.turn}-op`;
      const context = prepareHintRequest(room, actor);
      const scores = { ...scoresFor(room, actor), [context.board[0]!.id]: bad };
      expect(() =>
        applyTeamHint(
          room,
          actor,
          context,
          scores as Record<string, number>,
          NOW,
        ),
      ).toThrow("HINT_INVALID_RESPONSE");
      expect(room.ui.hints).toBeUndefined();
    },
  );
});
