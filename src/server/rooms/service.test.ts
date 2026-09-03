import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import roomsHandler from "../../../api/rooms";
import { startTestGame } from "../../engine/codenames/testFixtures";
import {
  handleRoomsRequest,
  resetAdminClientForTests,
  setAdminClientForTests,
} from "./service";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const ROOM_ID = "room-00000000-0000-4000-8000-000000000002";

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
  options: { authError?: boolean; member?: boolean } = {},
): SupabaseClient {
  const row = storedRoomRow();
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
        data: { user: options.authError ? null : { id: USER_ID } },
        error: options.authError ? new Error("invalid token") : null,
      })),
    },
    from,
    rpc: vi.fn(),
  } as unknown as SupabaseClient;
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
