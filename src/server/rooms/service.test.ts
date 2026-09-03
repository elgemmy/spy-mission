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
});

function request(body: unknown): Request {
  return new Request("https://game.example/api/rooms", {
    method: "POST",
    headers: {
      Authorization: "Bearer valid-player-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function fakeClient(): SupabaseClient {
  const row = storedRoomRow();
  const from = vi.fn((table: string) => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => ({
        data: table === "room_members" ? { room_id: ROOM_ID } : row,
        error: null,
      })),
    };
    return builder;
  });
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: USER_ID } },
        error: null,
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
