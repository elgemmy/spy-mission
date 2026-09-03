import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import roomsHandler from "../../../api/rooms";
import { startTestGame } from "../../engine/codenames/testFixtures";
import {
  initialPartnerMissionState,
  partnerMissionReducer,
} from "../../engine/partnerMission";
import { createHash } from "node:crypto";
import {
  handleRoomsRequest,
  resetAdminClientForTests,
  setAdminClientForTests,
} from "./service";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const ROOM_ID = "room-00000000-0000-4000-8000-000000000002";
const LEAD_ID = "00000000-0000-4000-8000-000000000099";
const AGENT_ID = "00000000-0000-4000-8000-000000000003";

describe("room server boundary", () => {
  afterEach(() => {
    resetAdminClientForTests();
  });

  it("boots through the Vercel entry point and rejects unsupported methods", async () => {
    const response = await roomsHandler.fetch(
      new Request("https://game.example/api/rooms", { method: "GET" }),
    );

    await expect(response.json()).resolves.toEqual({
      error: "METHOD_NOT_ALLOWED",
    });
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
  });

  it("returns an operative projection without hidden card identities", async () => {
    setAdminClientForTests(fakeClient());

    const response = await handleRoomsRequest(
      request({ op: "get", roomId: ROOM_ID }),
    );
    const payload = (await response.json()) as {
      data: { view: { board: Array<{ kind: unknown }> } };
    };

    expect(response.status).toBe(200);
    expect(payload.data).not.toHaveProperty("state");
    expect(payload.data.view.board.every((card) => card.kind === null)).toBe(
      true,
    );
    expect(JSON.stringify(payload)).not.toContain('"kind":"assassin"');
  });

  it("enforces host-only commands on the server", async () => {
    const client = fakeClient();
    setAdminClientForTests(client);

    const response = await handleRoomsRequest(
      request({
        op: "command",
        roomId: ROOM_ID,
        expectedVersion: 8,
        command: { type: "returnToLobby" },
      }),
    );

    await expect(response.json()).resolves.toEqual({ error: "NOT_HOST" });
    expect(response.status).toBe(403);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("does not persist an authorized command that changes nothing", async () => {
    const client = fakeClient();
    setAdminClientForTests(client);

    const response = await handleRoomsRequest(
      request({
        op: "command",
        roomId: ROOM_ID,
        expectedVersion: 8,
        command: { type: "renamePlayer", name: "Red OP" },
      }),
    );
    const payload = (await response.json()) as {
      data: { version: number };
    };

    expect(response.status).toBe(200);
    expect(payload.data.version).toBe(8);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("rejects unauthorized and illegal no-ops before persistence", async () => {
    const client = fakeClient();
    setAdminClientForTests(client);

    const unauthorized = await handleRoomsRequest(
      request({
        op: "command",
        roomId: ROOM_ID,
        expectedVersion: 8,
        command: { type: "setVisibility", visibility: "public" },
      }),
    );
    expect(unauthorized.status).toBe(403);
    await expect(unauthorized.json()).resolves.toEqual({ error: "NOT_HOST" });

    const illegal = await handleRoomsRequest(
      request({
        op: "command",
        roomId: ROOM_ID,
        expectedVersion: 8,
        command: { type: "clearVote" },
      }),
    );
    expect(illegal.status).toBe(409);
    await expect(illegal.json()).resolves.toEqual({ error: "WRONG_PHASE" });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("rejects requests without a player access token", async () => {
    setAdminClientForTests(fakeClient());
    const response = await handleRoomsRequest(
      new Request("https://game.example/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "get", roomId: ROOM_ID }),
      }),
    );

    await expect(response.json()).resolves.toEqual({ error: "UNAUTHORIZED" });
    expect(response.status).toBe(401);
  });

  it("rejects invalid access tokens", async () => {
    setAdminClientForTests(fakeClient({ authError: true }));

    const response = await handleRoomsRequest(
      request({ op: "get", roomId: ROOM_ID }),
    );

    await expect(response.json()).resolves.toEqual({ error: "UNAUTHORIZED" });
    expect(response.status).toBe(401);
  });

  it("rejects malformed JSON, unknown operations, and extra fields", async () => {
    setAdminClientForTests(fakeClient());

    const malformed = await handleRoomsRequest(requestText("{"));
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toEqual({
      error: "INVALID_REQUEST",
    });

    const unknown = await handleRoomsRequest(request({ op: "destroy" }));
    expect(unknown.status).toBe(400);

    const extra = await handleRoomsRequest(
      request({ op: "get", roomId: ROOM_ID, state: { secret: true } }),
    );
    expect(extra.status).toBe(400);
  });

  it("enforces actual request size when Content-Length is absent or false", async () => {
    setAdminClientForTests(fakeClient());
    const oversized = JSON.stringify({
      op: "get",
      roomId: ROOM_ID,
      padding: "x".repeat(17_000),
    });

    const absent = await handleRoomsRequest(requestText(oversized));
    expect(absent.status).toBe(413);
    await expect(absent.json()).resolves.toEqual({
      error: "REQUEST_TOO_LARGE",
    });

    const falseLength = await handleRoomsRequest(
      requestText(oversized, { "Content-Length": "1" }),
    );
    expect(falseLength.status).toBe(413);
  });

  it("rejects attempts to assign another player's team or role", async () => {
    const client = fakeClient();
    setAdminClientForTests(client);

    const response = await handleRoomsRequest(
      request({
        op: "command",
        roomId: ROOM_ID,
        expectedVersion: 8,
        command: {
          type: "assignSelf",
          team: "blue",
          role: "spymaster",
          targetPlayerId: "00000000-0000-4000-8000-000000000099",
        },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_REQUEST",
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("returns no room projection to a non-member", async () => {
    setAdminClientForTests(fakeClient({ member: false }));

    const response = await handleRoomsRequest(
      request({ op: "get", roomId: ROOM_ID }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: null });
  });

  it("returns structurally redacted Partner state to the Field Agent", async () => {
    const row = partnerRoomRow({ fieldAgentId: AGENT_ID });
    setAdminClientForTests(fakeClient({ row, userId: AGENT_ID }));

    const response = await handleRoomsRequest(
      request({ op: "get", roomId: ROOM_ID }),
    );
    const payload = (await response.json()) as {
      data: { mode: string; view: { board: Array<Record<string, unknown>> } };
    };

    expect(response.status).toBe(200);
    expect(payload.data.mode).toBe("partner");
    expect(payload.data).not.toHaveProperty("state");
    expect(payload.data.view.board).toHaveLength(25);
    expect(payload.data.view.board.every((card) => !("kind" in card))).toBe(
      true,
    );
    expect(JSON.stringify(payload.data.view.board)).not.toMatch(
      /"(?:kind|result)":/,
    );
  });

  it("routes nonmembers to Partner onboarding without exposing a board", async () => {
    setAdminClientForTests(
      fakeClient({ row: partnerRoomRow(), member: false, userId: AGENT_ID }),
    );

    const response = await handleRoomsRequest(
      request({ op: "resume", code: "PARTNER" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { status: "join", code: "PARTNER", mode: "partner" },
    });
  });

  it("creates Partner rooms as private Mission Lead rooms", async () => {
    const client = fakeClient({ userId: LEAD_ID });
    vi.mocked(client.rpc).mockImplementation(
      (_name, args) =>
        ({
          single: vi.fn(async () => ({
            data: {
              id: args?.p_id,
              code: args?.p_code,
              host_id: args?.p_host_id,
              visibility: args?.p_visibility,
              mode: args?.p_mode,
              state: args?.p_state,
              ui: args?.p_ui,
              version: args?.p_version,
              created_at: args?.p_created_at,
              updated_at: args?.p_updated_at,
              invite_hash: args?.p_invite_hash,
            },
            error: null,
          })),
        }) as never,
    );
    setAdminClientForTests(client);

    const response = await handleRoomsRequest(
      request({
        op: "create",
        name: "Lead",
        lang: "en",
        mode: "partner",
        visibility: "public",
      }),
    );
    const payload = (await response.json()) as {
      data: { mode: string; visibility: string; view: { viewerRole: string } };
    };

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      mode: "partner",
      visibility: "private",
      view: { viewerRole: "mission_lead" },
    });
    expect(vi.mocked(client.rpc).mock.calls[0]?.[0]).toBe("server_create_room");
    expect(vi.mocked(client.rpc).mock.calls[0]?.[1]).toMatchObject({
      p_mode: "partner",
      p_visibility: "private",
    });
  });

  it.each([LEAD_ID, AGENT_ID])(
    "resumes an active Partner member by authenticated identity (%s)",
    async (userId) => {
      setAdminClientForTests(
        fakeClient({ row: partnerRoomRow({ fieldAgentId: AGENT_ID }), userId }),
      );

      const response = await handleRoomsRequest(
        request({ op: "resume", code: "PARTNER" }),
      );
      const payload = (await response.json()) as {
        data: { status: string; room: { view: { viewerRole: string } } };
      };

      expect(response.status).toBe(200);
      expect(payload.data.status).toBe("active");
      expect(payload.data.room.view.viewerRole).toBe(
        userId === LEAD_ID ? "mission_lead" : "field_agent",
      );
    },
  );

  it("claims the Partner seat using authenticated identity rather than name", async () => {
    const invite = "a".repeat(43);
    const row = partnerRoomRow({ inviteToken: invite });
    const client = fakeClient({ row, member: false, userId: AGENT_ID });
    vi.mocked(client.rpc).mockImplementation(
      (_name, args) =>
        ({
          single: vi.fn(async () => ({
            data: { ...row, state: args?.p_state, version: 2 },
            error: null,
          })),
        }) as never,
    );
    setAdminClientForTests(client);

    const response = await handleRoomsRequest(
      request({
        op: "claimPartnerSeat",
        code: "PARTNER",
        name: "Cipher",
        inviteToken: invite,
      }),
    );
    const payload = (await response.json()) as {
      data: { view: { viewerRole: string; fieldAgentName: string } };
    };

    expect(response.status).toBe(200);
    expect(payload.data.view).toMatchObject({
      viewerRole: "field_agent",
      fieldAgentName: "Cipher",
    });
    const rpcArgs = vi.mocked(client.rpc).mock.calls[0]?.[1] as {
      p_state: { fieldAgent: { id: string; name: string } };
      p_partner_claim: boolean;
    };
    expect(rpcArgs.p_state.fieldAgent).toEqual({
      id: AGENT_ID,
      name: "Cipher",
    });
    expect(rpcArgs.p_partner_claim).toBe(true);
  });

  it("rejects a second identity after the Partner seat is claimed", async () => {
    const invite = "b".repeat(43);
    setAdminClientForTests(
      fakeClient({
        row: partnerRoomRow({ fieldAgentId: AGENT_ID, inviteToken: invite }),
        member: false,
        userId: USER_ID,
      }),
    );

    const response = await handleRoomsRequest(
      request({
        op: "claimPartnerSeat",
        code: "PARTNER",
        name: "Impostor",
        inviteToken: invite,
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "FIELD_AGENT_SEAT_TAKEN",
    });
  });

  it("rejects a stale Partner claim even for the already-bound identity", async () => {
    const invite = "c".repeat(43);
    const client = fakeClient({
      row: partnerRoomRow({ fieldAgentId: AGENT_ID, inviteToken: invite }),
      userId: AGENT_ID,
    });
    setAdminClientForTests(client);

    const response = await handleRoomsRequest(
      request({
        op: "claimPartnerSeat",
        code: "PARTNER",
        name: "Cipher again",
        inviteToken: invite,
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "WRONG_PHASE" });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("locks ordered Partner guesses without returning correctness", async () => {
    const baseRow = partnerRoomRow({ fieldAgentId: AGENT_ID });
    baseRow.state = partnerMissionReducer(
      baseRow.state as ReturnType<typeof initialPartnerMissionState>,
      { type: "giveSignal", word: "orbit", count: 2 },
      LEAD_ID,
    );
    baseRow.version = 3;
    const state = baseRow.state as ReturnType<
      typeof initialPartnerMissionState
    >;
    const cardIds = state.board.slice(0, 2).map((card) => card.id);
    const client = fakeClient({ row: baseRow, userId: AGENT_ID });
    vi.mocked(client.rpc).mockImplementation(
      (_name, args) =>
        ({
          single: vi.fn(async () => ({
            data: { ...baseRow, state: args?.p_state, version: 4 },
            error: null,
          })),
        }) as never,
    );
    setAdminClientForTests(client);

    const response = await handleRoomsRequest(
      request({
        op: "command",
        roomId: ROOM_ID,
        expectedVersion: 3,
        command: { type: "lockGuesses", cardIds, fieldNote: "Strongest first" },
      }),
    );
    const payload = (await response.json()) as {
      data: {
        view: { phase: string; lockedCardIds: string[]; board: unknown[] };
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data.view).toMatchObject({
      phase: "locked",
      lockedCardIds: cardIds,
    });
    expect(JSON.stringify(payload.data.view.board)).not.toMatch(
      /"(?:kind|result)":/,
    );
  });
});

function request(body: unknown): Request {
  return requestText(JSON.stringify(body));
}

function requestText(
  body: string,
  extraHeaders: Record<string, string> = {},
): Request {
  return new Request("https://game.example/api/rooms", {
    method: "POST",
    headers: {
      Authorization: "Bearer valid-player-token",
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body,
  });
}

function fakeClient(
  options: {
    authError?: boolean;
    member?: boolean;
    row?: Record<string, unknown>;
    userId?: string;
  } = {},
): SupabaseClient {
  const row = options.row ?? storedRoomRow();
  const from = vi.fn((table: string) => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => ({
        data:
          table === "room_members"
            ? options.member === false
              ? null
              : { room_id: ROOM_ID, status: "active" }
            : row,
        error: null,
      })),
    };
    return builder;
  });
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: options.authError ? null : { id: options.userId ?? USER_ID },
        },
        error: options.authError ? new Error("invalid token") : null,
      })),
    },
    from,
    rpc: vi.fn(),
  } as unknown as SupabaseClient;
}

function partnerRoomRow(
  options: {
    fieldAgentId?: string;
    inviteToken?: string;
  } = {},
): Record<string, unknown> {
  const concepts = Array.from({ length: 25 }, (_, index) => ({
    id: `concept-${index + 1}`,
    en: `Word ${index + 1}`,
    ar: `كلمة ${index + 1}`,
  }));
  let state = initialPartnerMissionState({
    roomId: ROOM_ID,
    lang: "en",
    missionLeadId: LEAD_ID,
    missionLeadName: "Lead",
    concepts,
    seed: 42,
  });
  if (options.fieldAgentId) {
    state = partnerMissionReducer(
      state,
      { type: "claimFieldAgent", name: "Cipher" },
      options.fieldAgentId,
    );
  }
  return {
    id: ROOM_ID,
    code: "PARTNER",
    host_id: LEAD_ID,
    visibility: "private",
    mode: "partner",
    state,
    ui: { votes: {}, clueLog: [], banners: [] },
    version: options.fieldAgentId ? 2 : 1,
    created_at: "2026-09-03T00:00:00.000Z",
    updated_at: "2026-09-03T00:00:01.000Z",
    invite_hash: options.inviteToken
      ? createHash("sha256").update(options.inviteToken).digest("hex")
      : "0".repeat(64),
  };
}

function storedRoomRow(): Record<string, unknown> {
  const state = startTestGame();
  state.roomId = ROOM_ID;
  state.players[USER_ID] = state.players["p-red-op"]!;
  delete state.players["p-red-op"];
  return {
    id: ROOM_ID,
    code: "TESTROOM",
    host_id: "00000000-0000-4000-8000-000000000099",
    visibility: "public",
    state,
    ui: { votes: {}, clueLog: [], banners: [] },
    version: 8,
    created_at: "2026-08-23T00:00:00.000Z",
    updated_at: "2026-08-23T00:00:01.000Z",
    invite_hash: null,
  };
}
