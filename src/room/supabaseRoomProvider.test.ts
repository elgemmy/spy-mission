import { afterEach, describe, expect, it, vi } from "vitest";
import type { RoomSnapshot } from "./types";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInAnonymously: vi.fn(),
  refreshSession: vi.fn(),
  setAuth: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
}));

vi.mock("../lib/supabase/client", () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: mocks.getSession,
      signInAnonymously: mocks.signInAnonymously,
      refreshSession: mocks.refreshSession,
    },
    realtime: { setAuth: mocks.setAuth },
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
  }),
}));

import { SupabaseRoomProvider } from "./supabaseRoomProvider";

describe("SupabaseRoomProvider", () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("creates rooms only through the authenticated server API", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "player-jwt" } },
      error: null,
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: snapshot() }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new SupabaseRoomProvider();
    await expect(
      provider.create({ name: "Player", lang: "ar" }),
    ).resolves.toEqual(snapshot());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/rooms",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer player-jwt",
        }),
      }),
    );
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(options.body))).toEqual({
      op: "create",
      name: "Player",
      lang: "ar",
    });
  });

  it("rejects a malformed success response from the room API", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "player-jwt" } },
      error: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("{}", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const provider = new SupabaseRoomProvider();
    await expect(provider.load(snapshot().id)).rejects.toThrow(
      "ROOM_API_ERROR",
    );
  });
});

function snapshot(): RoomSnapshot {
  return {
    id: "room-00000000-0000-4000-8000-000000000000",
    code: "TESTROOM",
    hostId: "00000000-0000-4000-8000-000000000001",
    visibility: "public",
    view: {
      roomId: "room-00000000-0000-4000-8000-000000000000",
      lang: "ar",
      phase: "lobby",
      board: [],
      turn: "red",
      clue: null,
      redRemaining: 0,
      blueRemaining: 0,
      guessesRemaining: null,
      winner: null,
      me: {
        id: "00000000-0000-4000-8000-000000000001",
        team: "red",
        role: "operative",
      },
      players: [],
      can: {
        joinRoom: false,
        assignSelf: true,
        setLang: true,
        startGame: false,
        giveClue: false,
        guess: false,
        endTurn: false,
      },
    },
    ui: { votes: {}, clueLog: [], banners: [] },
    version: 1,
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
  };
}
