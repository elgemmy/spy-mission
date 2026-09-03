import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomSnapshot } from "./types";

type BroadcastHandler = (message: { payload: unknown }) => void;

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInAnonymously: vi.fn(),
  refreshSession: vi.fn(),
  setAuth: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
  broadcastHandler: undefined as BroadcastHandler | undefined,
  subscribe: vi.fn(),
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
  beforeEach(() => {
    const channel = {
      on: vi.fn(
        (
          _type: string,
          _filter: Record<string, string>,
          handler: BroadcastHandler,
        ) => {
          mocks.broadcastHandler = handler;
          return channel;
        },
      ),
      subscribe: mocks.subscribe.mockImplementation(() => channel),
    };
    mocks.channel.mockReturnValue(channel);
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    mocks.broadcastHandler = undefined;
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

  it("resumes a room through the authenticated code path", async () => {
    authenticatedSession();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: "active", room: snapshot() }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new SupabaseRoomProvider();
    await expect(provider.resume("testroom")).resolves.toEqual({
      status: "active",
      room: snapshot(),
    });

    expect(requestBody(fetchMock)).toEqual({
      op: "resume",
      code: "testroom",
    });
  });

  it("caches a fragment invite after joining a private room", async () => {
    authenticatedSession();
    const privateRoom = { ...snapshot(), visibility: "private" as const };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(privateRoom)),
    );

    const provider = new SupabaseRoomProvider();
    await provider.join({
      code: privateRoom.code,
      name: "Guest",
      inviteToken: "invite-token-from-fragment",
    });

    expect(provider.getInviteToken(privateRoom.id)).toBe(
      "invite-token-from-fragment",
    );
  });

  it("preserves the invite across public/private visibility toggles", async () => {
    authenticatedSession();
    const privateRoom = {
      ...snapshot(),
      visibility: "private" as const,
      inviteToken: "stable-private-token",
    };
    const publicRoom = {
      ...snapshot(),
      visibility: "public" as const,
      version: 2,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(privateRoom))
      .mockResolvedValueOnce(jsonResponse(publicRoom));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new SupabaseRoomProvider();
    await provider.create({ name: "Host", lang: "ar", visibility: "private" });
    await provider.mutate(privateRoom.id, 1, {
      type: "setVisibility",
      visibility: "public",
    });

    expect(provider.getInviteToken(privateRoom.id)).toBe(
      "stable-private-token",
    );
  });

  it("ejects immediately on the state-free deletion broadcast", async () => {
    authenticatedSession();
    const privateRoom = {
      ...snapshot(),
      visibility: "private" as const,
      inviteToken: "private-token",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(privateRoom)),
    );
    const provider = new SupabaseRoomProvider();
    await provider.create({ name: "Host", lang: "ar", visibility: "private" });
    const onChange = vi.fn();

    const unsubscribe = provider.subscribe(snapshot().id, onChange);
    await vi.waitFor(() => expect(mocks.subscribe).toHaveBeenCalled());
    mocks.broadcastHandler?.({ payload: { deleted: true } });

    expect(onChange).toHaveBeenCalledWith(null);
    expect(provider.getInviteToken(snapshot().id)).toBeNull();
    unsubscribe();
  });

  it("removes obsolete invite cache entries during startup", () => {
    localStorage.setItem(
      `codenames.roomInvite.${snapshot().id}`,
      "obsolete-token",
    );

    new SupabaseRoomProvider();

    expect(
      localStorage.getItem(`codenames.roomInvite.${snapshot().id}`),
    ).toBeNull();
  });

  it("uses bounded polling to discover deletion when Realtime is unavailable", async () => {
    vi.useFakeTimers();
    authenticatedSession();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(null)));
    const provider = new SupabaseRoomProvider();
    const onChange = vi.fn();

    const unsubscribe = provider.subscribe(snapshot().id, onChange);
    await vi.advanceTimersByTimeAsync(5_000);

    expect(onChange).toHaveBeenCalledWith(null);
    unsubscribe();
  });

  it("ejects on a permanently expired Auth session but not a transient fetch", async () => {
    vi.useFakeTimers();
    authenticatedSession();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    mocks.refreshSession.mockResolvedValue({
      data: { session: null },
      error: new Error("expired"),
    });
    vi.stubGlobal("fetch", fetchMock);
    const provider = new SupabaseRoomProvider();
    const onChange = vi.fn();
    const unsubscribe = provider.subscribe(snapshot().id, onChange);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(onChange).toHaveBeenCalledWith(null);

    onChange.mockClear();
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "player-jwt" } },
      error: null,
    });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(onChange).not.toHaveBeenCalled();
    unsubscribe();
  });
});

function authenticatedSession(): void {
  mocks.getSession.mockResolvedValue({
    data: { session: { access_token: "player-jwt" } },
    error: null,
  });
}

function jsonResponse<T>(data: T): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function requestBody(fetchMock: ReturnType<typeof vi.fn>): unknown {
  const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
  return JSON.parse(String(options.body)) as unknown;
}

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
