import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  makeConcepts,
  startTestGame,
} from "../../engine/codenames/testFixtures";
import { applyRoomCommand } from "../../room/commands";
import {
  applyPartnerRoomAction,
  createPartnerRoomRecord,
} from "../../room/partner";
import { HintError, type HintContext } from "../../room/hints";
import type { RoomRecord, SharedRoomRecord } from "../../room/types";
import { scoreHint } from "../hints/jev";
import {
  handleRoomsRequest,
  resetAdminClientForTests,
  setAdminClientForTests,
} from "./service";

vi.mock("../hints/jev", () => ({ scoreHint: vi.fn() }));

const ROOM_ID = "room-00000000-0000-4000-8000-000000000002";
const NOW = "2026-09-22T12:00:00.000Z";

function classicRoom(): RoomRecord {
  const state = startTestGame();
  state.roomId = ROOM_ID;
  return applyRoomCommand(
    {
      id: ROOM_ID,
      code: "TESTROOM",
      hostId: "p-red-sm",
      visibility: "public",
      state,
      ui: { votes: {}, clueLog: [], banners: [] },
      version: 8,
      createdAt: NOW,
      updatedAt: NOW,
    },
    `p-${state.turn}-sm`,
    { type: "giveClue", word: "space", count: 3 },
    NOW,
  );
}

function partnerRoom(partnerType: "ai" | "human") {
  let room = createPartnerRoomRecord({
    id: ROOM_ID,
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
    { type: "claimFieldAgent", name: "Agent" },
    NOW,
  );
  if (partnerType === "human")
    room = applyPartnerRoomAction(
      room,
      "lead",
      { type: "startPartnerMission" },
      NOW,
    );
  return applyPartnerRoomAction(
    room,
    "lead",
    { type: "giveSignal", word: "space", count: 2 },
    NOW,
  );
}

function scores(context: HintContext, score = 0.7): Record<string, number> {
  return Object.fromEntries(
    context.board
      .filter((card) => !card.revealed)
      .map((card) => [card.id, score]),
  );
}

function boundary(initial: SharedRoomRecord) {
  let room = initial;
  let beforePersist: (() => void) | undefined;
  let active = true;
  const row = () =>
    structuredClone({
      id: room.id,
      code: room.code,
      host_id: room.hostId,
      visibility: room.visibility,
      mode: room.mode ?? "classic",
      state: room.state,
      ui: room.ui,
      version: room.version,
      created_at: room.createdAt,
      updated_at: room.updatedAt,
      invite_hash: null,
    });
  const rpc = vi.fn((_name: string, args: Record<string, unknown>) => ({
    single: async () => {
      const hook = beforePersist;
      beforePersist = undefined;
      hook?.();
      if (args.p_expected_version !== room.version)
        return { data: null, error: { code: "40001" } };
      room = {
        ...room,
        state: args.p_state,
        ui: args.p_ui,
        version: room.version + 1,
        updatedAt: args.p_updated_at,
      } as SharedRoomRecord;
      return { data: row(), error: null };
    },
  }));
  const client = {
    auth: {
      getUser: vi.fn(async (token: string) => ({
        data: { user: { id: token } },
        error: null,
      })),
    },
    from: (table: string) => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({
          data:
            table === "room_members"
              ? active
                ? { status: "active" }
                : null
              : row(),
          error: null,
        }),
      };
      return builder;
    },
    rpc,
  } as unknown as SupabaseClient;
  setAdminClientForTests(client);
  return {
    get room() {
      return room;
    },
    set room(next: SharedRoomRecord) {
      room = next;
    },
    rpc,
    revoke: () => {
      active = false;
    },
    raceOnSave: (hook: () => void) => {
      beforePersist = hook;
    },
  };
}

function requestHint(
  actor: string,
  expectedVersion: number,
  extra: Record<string, unknown> = {},
) {
  return handleRoomsRequest(
    new Request("https://game.example/api/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${actor}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        op: "command",
        roomId: ROOM_ID,
        expectedVersion,
        command: { type: "requestHint", ...extra },
      }),
    }),
  );
}

function deferredHint() {
  let complete!: (result: Record<string, number>) => void;
  let started!: (context: HintContext) => void;
  const ready = new Promise<HintContext>((resolve) => {
    started = resolve;
  });
  vi.mocked(scoreHint).mockImplementation((context) => {
    started(context);
    return new Promise((resolve) => {
      complete = resolve;
    });
  });
  return { ready, resolve: (value: Record<string, number>) => complete(value) };
}

beforeEach(() => {
  vi.mocked(scoreHint)
    .mockReset()
    .mockImplementation(async (context) => scores(context));
});
afterEach(() => {
  resetAdminClientForTests();
});

describe("authenticated hint command", () => {
  it("stores one team hint and reuses it for a repeated stale-version request", async () => {
    const room = classicRoom();
    const actor = `p-${room.state.turn}-op`;
    const store = boundary(room);
    const response = await requestHint(actor, room.version);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data.hint).toMatchObject({
      used: true,
      canRequest: false,
      scores: expect.any(Object),
    });
    expect(payload.data.ui).not.toHaveProperty("hints");
    expect(JSON.stringify(payload.data)).not.toMatch(
      /"kind":"(?:red|blue|assassin)"/,
    );
    expect(store.room.version).toBe(room.version + 1);
    const repeated = await requestHint(actor, room.version);
    expect(await repeated.json()).toEqual(payload);
    expect(scoreHint).toHaveBeenCalledTimes(1);
    expect(store.rpc).toHaveBeenCalledTimes(1);
  });

  it.each(["ai", "human"] as const)(
    "uses the same protected command for %s partner missions",
    async (kind) => {
      const room = partnerRoom(kind);
      const store = boundary(room);
      const response = await requestHint("agent", room.version);
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.data.hint.used).toBe(true);
      expect(payload.data.mode).toBe("partner");
      expect(payload.data).not.toHaveProperty("ui");
      expect(store.room.ui.hints?.partner).toBeDefined();
      expect(JSON.stringify(payload.data.view.board)).not.toMatch(
        /"(?:kind|result)":/,
      );
    },
  );

  it("rejects nonmembers, leads, opponents, missing turns, and client-supplied context", async () => {
    const room = classicRoom();
    const actor = `p-${room.state.turn}-op`;
    const store = boundary(room);
    const lead = await requestHint(`p-${room.state.turn}-sm`, room.version);
    expect(lead.status).toBe(403);
    const opponent = await requestHint(
      `p-${room.state.turn === "red" ? "blue" : "red"}-op`,
      room.version,
    );
    expect(await opponent.json()).toEqual({ error: "HINT_NOT_AVAILABLE" });
    const extra = await requestHint(actor, room.version, {
      clue: "injected",
      board: [],
    });
    expect(extra.status).toBe(400);
    const stale = await requestHint(actor, room.version - 1);
    expect(await stale.json()).toEqual({ error: "ROOM_VERSION_CONFLICT" });
    store.room = { ...room, state: { ...room.state, phase: "clue" } };
    expect((await requestHint(actor, room.version)).status).toBe(409);
    store.revoke();
    expect((await requestHint(actor, room.version)).status).toBe(404);
    expect(scoreHint).not.toHaveBeenCalled();
    expect(store.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["HINT_NOT_CONFIGURED", 503],
    ["HINT_TIMEOUT", 504],
    ["HINT_PROVIDER_FAILED", 502],
    ["HINT_INVALID_RESPONSE", 502],
  ] as const)(
    "does not consume a hint when inference fails with %s",
    async (code, status) => {
      const room = classicRoom();
      const store = boundary(room);
      vi.mocked(scoreHint).mockRejectedValue(new HintError(code));
      const response = await requestHint(
        `p-${room.state.turn}-op`,
        room.version,
      );
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: code });
      expect(store.room.ui.hints).toBeUndefined();
      expect(store.rpc).not.toHaveBeenCalled();
    },
  );

  it("rejects incomplete scores before consuming the hint", async () => {
    const room = classicRoom();
    const store = boundary(room);
    vi.mocked(scoreHint).mockResolvedValue({});
    const response = await requestHint(`p-${room.state.turn}-op`, room.version);
    expect(await response.json()).toEqual({ error: "HINT_INVALID_RESPONSE" });
    expect(store.room.ui.hints).toBeUndefined();
    expect(store.rpc).not.toHaveBeenCalled();
  });

  it("keeps only the first result from simultaneous requests by teammates", async () => {
    const room = classicRoom();
    const actor = `p-${room.state.turn}-op`;
    room.state.players.peer = {
      name: "Peer",
      role: "operative",
      team: room.state.turn,
    };
    const store = boundary(room);
    vi.mocked(scoreHint)
      .mockImplementationOnce(async (context) => scores(context, 0.8))
      .mockImplementationOnce(async (context) => scores(context, 0.2));
    const responses = await Promise.all([
      requestHint(actor, room.version),
      requestHint("peer", room.version),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const payloads = await Promise.all(
      responses.map((response) => response.json()),
    );
    expect(payloads[0].data.hint).toEqual(payloads[1].data.hint);
    expect(new Set(Object.values(payloads[0].data.hint.scores))).toEqual(
      new Set([0.8]),
    );
    expect(store.room.version).toBe(room.version + 1);
  });

  it("retries CAS after a concurrent vote without calling JEV twice or losing the vote", async () => {
    const room = classicRoom();
    const actor = `p-${room.state.turn}-op`;
    const store = boundary(room);
    store.raceOnSave(() => {
      store.room = applyRoomCommand(
        store.room as RoomRecord,
        actor,
        { type: "vote", cardIndex: 0 },
        NOW,
      );
    });
    const response = await requestHint(actor, room.version);
    expect(response.status).toBe(200);
    expect(store.room.ui.votes[actor]).toBe(0);
    expect(store.room.ui.hints?.[room.state.turn]).toBeDefined();
    expect(store.rpc).toHaveBeenCalledTimes(2);
    expect(scoreHint).toHaveBeenCalledTimes(1);
  });

  it.each(["turn", "board", "restart", "membership"] as const)(
    "discards results when %s changes during inference",
    async (change) => {
      const room = classicRoom();
      const actor = `p-${room.state.turn}-op`;
      const store = boundary(room);
      const pending = deferredHint();
      const responsePromise = requestHint(actor, room.version);
      const context = await pending.ready;
      if (change === "turn") {
        const next = structuredClone(room);
        next.state.guessesMadeThisTurn = 1;
        store.room = applyRoomCommand(next, actor, { type: "endTurn" }, NOW);
      } else if (change === "board") {
        const next = structuredClone(room);
        next.state.board[0]!.revealed = true;
        next.version += 1;
        store.room = next;
      } else if (change === "restart") {
        let next = applyRoomCommand(
          room,
          room.hostId,
          { type: "returnToLobby" },
          NOW,
        );
        next = applyRoomCommand(
          next,
          room.hostId,
          { type: "startGame" },
          NOW,
          42,
        );
        store.room = applyRoomCommand(
          next,
          `p-${next.state.turn}-sm`,
          { type: "giveClue", word: "space", count: 3 },
          NOW,
        );
      } else store.revoke();
      pending.resolve(scores(context));
      const response = await responsePromise;
      expect(await response.json()).toEqual({
        error: change === "membership" ? "ROOM_NOT_FOUND" : "HINT_STALE",
      });
      expect(store.room.ui.hints).toBeUndefined();
      expect(store.rpc).not.toHaveBeenCalled();
    },
  );
});
