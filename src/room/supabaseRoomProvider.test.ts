import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  initialPartnerMissionState,
  partnerMissionReducer,
  partnerMissionViewFor,
} from "../engine/partnerMission";
import type { PartnerRoomSnapshot, RoomSnapshot } from "./types";

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

import {
  ROOM_POLL_INTERVAL_MS,
  ROOM_POLL_TIMEOUT_MS,
  resetAnonymousSessionInitializationForTests,
  runStorageAuthLockForTests,
  SupabaseRoomProvider,
} from "./supabaseRoomProvider";

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
    resetAnonymousSessionInitializationForTests();
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

  it("single-flights concurrent anonymous session initialization", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mocks.signInAnonymously.mockResolvedValue({
      data: { session: { access_token: "one-anonymous-jwt" } },
      error: null,
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(() => Promise.resolve(jsonResponse(snapshot()))),
    );
    const provider = new SupabaseRoomProvider();

    await Promise.all([
      provider.create({ name: "First tab", lang: "ar" }),
      provider.create({ name: "Second tab", lang: "ar" }),
    ]);

    expect(mocks.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it("rechecks the session inside the cross-tab lock before signing in", async () => {
    mocks.getSession
      .mockResolvedValueOnce({ data: { session: null }, error: null })
      .mockResolvedValueOnce({
        data: { session: { access_token: "other-tab-jwt" } },
        error: null,
      });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(snapshot())));

    await new SupabaseRoomProvider().create({ name: "Player", lang: "ar" });

    expect(mocks.getSession).toHaveBeenCalledTimes(2);
    expect(mocks.signInAnonymously).not.toHaveBeenCalled();
  });

  it("serializes independent storage-lock callers without an expiring lease", async () => {
    vi.useFakeTimers();
    let releaseFirst: (() => void) | undefined;
    let firstEntered = false;
    let secondEntered = false;
    const first = runStorageAuthLockForTests(async () => {
      firstEntered = true;
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
    });
    await Promise.resolve();
    expect(firstEntered).toBe(true);

    const second = runStorageAuthLockForTests(async () => {
      secondEntered = true;
    });
    await vi.advanceTimersByTimeAsync(15_000);

    expect(secondEntered).toBe(false);
    releaseFirst?.();
    await first;
    await vi.advanceTimersByTimeAsync(50);
    await second;
    expect(secondEntered).toBe(true);
  });

  it("fails closed when shared storage is unavailable", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "localStorage",
    );
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get: () => {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
    try {
      await expect(
        runStorageAuthLockForTests(async () => undefined),
      ).rejects.toThrow("ANONYMOUS_AUTH_LOCK_UNAVAILABLE");
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, "localStorage", descriptor);
      } else {
        Reflect.deleteProperty(globalThis, "localStorage");
      }
    }
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

  it("claims the Partner seat through the dedicated authenticated operation", async () => {
    authenticatedSession();
    const room = partnerSnapshot();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(room));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new SupabaseRoomProvider();
    await expect(
      provider.claimPartnerSeat({
        code: room.code,
        name: "Cipher",
        inviteToken: "partner-invite-token-from-fragment",
      }),
    ).resolves.toMatchObject({ mode: "partner" });

    expect(requestBody(fetchMock)).toEqual({
      op: "claimPartnerSeat",
      code: room.code,
      name: "Cipher",
      inviteToken: "partner-invite-token-from-fragment",
    });
    expect(provider.getInviteToken(room.id)).toBe(
      "partner-invite-token-from-fragment",
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

  it("preserves invite context after a transient resume failure", async () => {
    authenticatedSession();
    const privateRoom = {
      ...snapshot(),
      visibility: "private" as const,
      inviteToken: "stable-private-token",
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(privateRoom))
        .mockRejectedValueOnce(new TypeError("Failed to fetch")),
    );
    const provider = new SupabaseRoomProvider();
    await provider.create({ name: "Host", lang: "ar", visibility: "private" });

    await expect(provider.resume(privateRoom.code)).rejects.toThrow(
      "Failed to fetch",
    );
    expect(provider.getInviteToken(privateRoom.id)).toBe(
      "stable-private-token",
    );
  });

  it("caches the stable token created for a public room", async () => {
    authenticatedSession();
    const publicRoom = {
      ...snapshot(),
      inviteToken: "stable-room-token",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(jsonResponse(publicRoom)),
    );
    const provider = new SupabaseRoomProvider();
    await provider.create({ name: "Host", lang: "ar" });

    expect(provider.getInviteToken(publicRoom.id)).toBe("stable-room-token");
  });

  it("clears the invite cache through the explicit teardown method", async () => {
    authenticatedSession();
    const privateRoom = {
      ...snapshot(),
      visibility: "private" as const,
      inviteToken: "private-token",
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(privateRoom))
        .mockResolvedValueOnce(jsonResponse({ left: true })),
    );
    const provider = new SupabaseRoomProvider();
    await provider.create({ name: "Host", lang: "ar", visibility: "private" });

    await provider.mutate(privateRoom.id, privateRoom.version, {
      type: "leaveRoom",
    });

    expect(provider.getInviteToken(privateRoom.id)).toBe("private-token");
    provider.clearRoomStorage(privateRoom.id);
    expect(provider.getInviteToken(privateRoom.id)).toBeNull();
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
    expect(provider.getInviteToken(snapshot().id)).toBe("private-token");
    provider.clearRoomStorage(snapshot().id);
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

  it("aborts a hung poll and continues with the next interval", async () => {
    vi.useFakeTimers();
    authenticatedSession();
    let firstSignal: AbortSignal | undefined;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        (_input: RequestInfo | URL, init?: RequestInit) => {
          firstSignal = init?.signal ?? undefined;
          return new Promise<Response>((_resolve, reject) => {
            firstSignal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          });
        },
      )
      .mockResolvedValueOnce(jsonResponse(snapshot()));
    vi.stubGlobal("fetch", fetchMock);
    const onChange = vi.fn();
    const unsubscribe = new SupabaseRoomProvider().subscribe(
      snapshot().id,
      onChange,
    );

    await vi.advanceTimersByTimeAsync(ROOM_POLL_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(ROOM_POLL_TIMEOUT_MS);
    expect(firstSignal?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(
      ROOM_POLL_INTERVAL_MS - ROOM_POLL_TIMEOUT_MS,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledWith(snapshot());
    unsubscribe();
  });

  it("ignores queued fetch and Realtime callbacks after unsubscribe", async () => {
    vi.useFakeTimers();
    authenticatedSession();
    let resolveFetch: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
    const provider = new SupabaseRoomProvider();
    const roomAChange = vi.fn();
    const unsubscribeA = provider.subscribe(snapshot().id, roomAChange);
    await vi.waitFor(() => expect(mocks.subscribe).toHaveBeenCalledTimes(1));
    const staleBroadcast = mocks.broadcastHandler;
    await vi.advanceTimersByTimeAsync(ROOM_POLL_INTERVAL_MS);
    unsubscribeA();

    const roomB = { ...snapshot(), id: "room-b", code: "ROOMB" };
    const roomBChange = vi.fn();
    const unsubscribeB = provider.subscribe(roomB.id, roomBChange);
    await vi.waitFor(() => expect(mocks.subscribe).toHaveBeenCalledTimes(2));
    staleBroadcast?.({ payload: { deleted: true } });
    resolveFetch?.(jsonResponse(null));
    await Promise.resolve();
    await Promise.resolve();

    expect(roomAChange).not.toHaveBeenCalled();
    expect(roomBChange).not.toHaveBeenCalled();
    unsubscribeB();
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

  it.each(["ROOM_BANNED", "ROOM_NOT_MEMBER"])(
    "ejects when polling reports permanent room access loss: %s",
    async (code) => {
      vi.useFakeTimers();
      authenticatedSession();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ error: code }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      );
      const onChange = vi.fn();
      const unsubscribe = new SupabaseRoomProvider().subscribe(
        snapshot().id,
        onChange,
      );

      await vi.advanceTimersByTimeAsync(ROOM_POLL_INTERVAL_MS);

      expect(onChange).toHaveBeenCalledWith(null);
      unsubscribe();
    },
  );
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

function partnerSnapshot(): PartnerRoomSnapshot {
  const concepts = Array.from({ length: 25 }, (_, index) => ({
    id: `concept-${index + 1}`,
    en: `Word ${index + 1}`,
    ar: `كلمة ${index + 1}`,
  }));
  const waiting = initialPartnerMissionState({
    roomId: "room-00000000-0000-4000-8000-000000000099",
    lang: "en",
    missionLeadId: "00000000-0000-4000-8000-000000000001",
    missionLeadName: "Lead",
    concepts,
    seed: 42,
  });
  const joined = partnerMissionReducer(
    waiting,
    { type: "claimFieldAgent", name: "Cipher" },
    "00000000-0000-4000-8000-000000000002",
  );
  return {
    mode: "partner",
    id: joined.roomId,
    code: "PARTNER",
    hostId: joined.missionLead.id,
    visibility: "private",
    view: partnerMissionViewFor(joined, "00000000-0000-4000-8000-000000000002"),
    version: 2,
    createdAt: "2026-09-03T00:00:00.000Z",
    updatedAt: "2026-09-03T00:00:01.000Z",
  };
}
