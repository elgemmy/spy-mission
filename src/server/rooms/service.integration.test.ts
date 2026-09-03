// @vitest-environment node

import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import type {
  RoomCommand,
  RoomMutationResult,
  RoomSnapshot,
  ResumeRoomResult,
} from "../../room/types";
import { handleRoomsRequest, resetAdminClientForTests } from "./service";

const enabled = process.env.RUN_SUPABASE_INTEGRATION === "1";
const supabaseUrl = process.env.SUPABASE_URL ?? "";
const publishableKey = process.env.VITE_SUPABASE_ANON_KEY ?? "";
const secretKey =
  process.env.SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "";

interface Identity {
  token: string;
  userId: string;
}

type ApiData = RoomSnapshot | RoomMutationResult | ResumeRoomResult | null;

describe.skipIf(!enabled).sequential("secure multiplayer integration", () => {
  afterAll(() => {
    resetAdminClientForTests();
  });

  it("keeps identity separate from mutable and duplicate display names", async () => {
    const [host, first, second] = await Promise.all([
      anonymousIdentity(),
      anonymousIdentity(),
      anonymousIdentity(),
    ]);
    const created = await createRoom(host, "Same");

    try {
      await Promise.all([
        joinRoom(first, created.code, "Same"),
        joinRoom(second, created.code, "Same"),
      ]);
      const joinedAgain = await joinRoom(first, created.code, "Replacement");
      const resumed = await success<ResumeRoomResult>(first, {
        op: "resume",
        code: created.code,
      });
      const current = await getRoom(host, created.id);

      expect(resumed.status).toBe("active");
      if (resumed.status !== "active") {
        throw new Error("ACTIVE_RESUME_EXPECTED");
      }
      expect(resumed.room.view.me?.id).toBe(first.userId);
      expect(joinedAgain.view.me?.id).toBe(first.userId);
      expect(
        joinedAgain.view.players.find((player) => player.id === first.userId)
          ?.name,
      ).toBe("Same");
      expect(
        current.view.players.filter((player) => player.name === "Same"),
      ).toHaveLength(3);
      expect(
        new Set(current.view.players.map((player) => player.id)).size,
      ).toBe(3);

      const firstPrivateTransition = await command(host, created.id, {
        type: "setVisibility",
        visibility: "private",
      });
      expect(firstPrivateTransition.inviteToken).toBeTruthy();
    } finally {
      await deleteIfPresent(host, created.id);
    }
  }, 20_000);

  it("serializes simultaneous joins and rejects stale commands", async () => {
    const [host, first, second, sameBrowser] = await Promise.all([
      anonymousIdentity(),
      anonymousIdentity(),
      anonymousIdentity(),
      anonymousIdentity(),
    ]);
    const created = await createRoom(host, "Host");

    try {
      await Promise.all([
        joinRoom(first, created.code, "First"),
        joinRoom(second, created.code, "Second"),
      ]);
      await Promise.all([
        joinRoom(sameBrowser, created.code, "One tab"),
        joinRoom(sameBrowser, created.code, "Other tab"),
      ]);
      const before = await getRoom(host, created.id);
      expect(before.view.players.map((player) => player.id)).toEqual(
        expect.arrayContaining([
          host.userId,
          first.userId,
          second.userId,
          sameBrowser.userId,
        ]),
      );
      expect(
        before.view.players.filter(
          (player) => player.id === sameBrowser.userId,
        ),
      ).toHaveLength(1);

      await commandAt(host, created.id, before.version, {
        type: "renamePlayer",
        name: "Current host",
      });
      const stale = await call(host, {
        op: "command",
        roomId: created.id,
        expectedVersion: before.version,
        command: { type: "setLang", lang: "en" },
      });
      expect(stale.response.status).toBe(409);
      expect(stale.payload.error).toBe("ROOM_VERSION_CONFLICT");

      const after = await getRoom(host, created.id);
      expect(
        after.view.players.find((player) => player.id === host.userId)?.name,
      ).toBe("Current host");
      expect(after.view.lang).toBe("ar");
    } finally {
      await deleteIfPresent(host, created.id);
    }
  }, 20_000);

  it("returns role projections without leaking the authoritative room state", async () => {
    const [host, redOperative, blueSpymaster, blueOperative] =
      await Promise.all([
        anonymousIdentity(),
        anonymousIdentity(),
        anonymousIdentity(),
        anonymousIdentity(),
      ]);
    const created = await createRoom(host, "Host");

    try {
      await command(host, created.id, {
        type: "assignSelf",
        team: "red",
        role: "spymaster",
      });
      await Promise.all([
        joinRoom(redOperative, created.code, "Red operative"),
        joinRoom(blueSpymaster, created.code, "Blue spymaster"),
        joinRoom(blueOperative, created.code, "Blue operative"),
      ]);
      await command(redOperative, created.id, {
        type: "assignSelf",
        team: "red",
        role: "operative",
      });
      await command(blueSpymaster, created.id, {
        type: "assignSelf",
        team: "blue",
        role: "spymaster",
      });
      await command(blueOperative, created.id, {
        type: "assignSelf",
        team: "blue",
        role: "operative",
      });
      await command(host, created.id, { type: "startGame" });

      const operativeView = await getRoom(redOperative, created.id);
      const spymasterView = await getRoom(blueSpymaster, created.id);
      expect(operativeView).not.toHaveProperty("state");
      expect(operativeView.view.board).toHaveLength(25);
      expect(operativeView.view.board.every((card) => card.kind === null)).toBe(
        true,
      );
      expect(spymasterView.view.board.every((card) => card.kind !== null)).toBe(
        true,
      );
      expect(JSON.stringify(operativeView)).not.toContain('"kind":"assassin"');
    } finally {
      await deleteIfPresent(host, created.id);
    }
  }, 20_000);

  it("enforces private invitations, durable bans, and atomic lobby leave", async () => {
    const [host, member, toggledMember, banned, leaver] = await Promise.all([
      anonymousIdentity(),
      anonymousIdentity(),
      anonymousIdentity(),
      anonymousIdentity(),
      anonymousIdentity(),
    ]);
    const created = await createRoom(host, "Private host", "private");
    const initialToken = created.inviteToken;
    if (!initialToken) {
      throw new Error("PRIVATE_INVITE_MISSING");
    }

    try {
      const denied = await call(member, {
        op: "join",
        code: created.code,
        name: "Member",
      });
      expect(denied.response.status).toBe(403);
      expect(denied.payload.error).toBe("ROOM_INVITE_INVALID");

      await joinRoom(member, created.code, "Member", initialToken);
      const resumed = await success<ResumeRoomResult>(member, {
        op: "resume",
        code: created.code,
      });
      expect(resumed.status).toBe("active");

      const publicRoom = await command(host, created.id, {
        type: "setVisibility",
        visibility: "public",
      });
      expect(publicRoom.visibility).toBe("public");
      const privateAgain = await command(host, created.id, {
        type: "setVisibility",
        visibility: "private",
      });
      expect(privateAgain.visibility).toBe("private");
      await joinRoom(toggledMember, created.code, "Old token", initialToken);

      const regenerated = await command(host, created.id, {
        type: "regenerateInvite",
      });
      expect(regenerated.version).toBeGreaterThan(privateAgain.version);
      expect(regenerated.inviteToken).toBeTruthy();
      expect(regenerated.inviteToken).not.toBe(initialToken);

      const oldTokenDenied = await call(banned, {
        op: "join",
        code: created.code,
        name: "Old link",
        inviteToken: initialToken,
      });
      expect(oldTokenDenied.response.status).toBe(403);
      expect(oldTokenDenied.payload.error).toBe("ROOM_INVITE_INVALID");
      await joinRoom(
        banned,
        created.code,
        "Banned later",
        regenerated.inviteToken,
      );
      await joinRoom(leaver, created.code, "Leaving", regenerated.inviteToken);

      const realtime = createClient(supabaseUrl, publishableKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      realtime.realtime.setAuth(banned.token);
      const bannedChannel = realtime.channel(`room:${created.id}`, {
        config: { private: true },
      });
      let resolveBanPayload:
        | ((payload: Record<string, unknown>) => void)
        | undefined;
      const banPayloadPromise = new Promise<Record<string, unknown>>(
        (resolve) => {
          resolveBanPayload = resolve;
        },
      );
      await subscribe(bannedChannel, (message) => {
        resolveBanPayload?.(message.payload as Record<string, unknown>);
      });

      const afterBan = await command(host, created.id, {
        type: "banPlayer",
        targetPlayerId: banned.userId,
      });
      const banPayload = await withTimeout(
        banPayloadPromise,
        "REALTIME_BAN_TIMEOUT",
      );
      expect(banPayload).not.toHaveProperty("state");
      await realtime.removeChannel(bannedChannel);

      const bannedFreshChannel = realtime.channel(`room:${created.id}`, {
        config: { private: true },
      });
      expect(await rejectedSubscriptionStatus(bannedFreshChannel)).toMatch(
        /CHANNEL_ERROR|TIMED_OUT|CLOSED/,
      );
      await realtime.removeChannel(bannedFreshChannel);

      expect(
        await success<null>(banned, { op: "get", roomId: created.id }),
      ).toBeNull();
      for (const body of [
        { op: "resume", code: created.code },
        {
          op: "join",
          code: created.code,
          name: "Return",
          inviteToken: regenerated.inviteToken,
        },
        {
          op: "command",
          roomId: created.id,
          expectedVersion: afterBan.version,
          command: { type: "assignSelf", team: "red", role: "operative" },
        },
      ]) {
        const result = await call(banned, body);
        expect(result.response.status).toBeGreaterThanOrEqual(403);
      }

      const leaveResult = await commandRaw(leaver, created.id, {
        type: "leaveRoom",
      });
      expect(leaveResult).toEqual({ left: true });
      expect(
        await success<null>(leaver, { op: "get", roomId: created.id }),
      ).toBeNull();
      const afterLeave = await getRoom(host, created.id);
      expect(
        afterLeave.view.players.some((player) => player.id === leaver.userId),
      ).toBe(false);

      const admin = adminClient();
      const { data: bannedMembership, error: bannedMembershipError } =
        await admin
          .from("room_members")
          .select("status,banned_at,banned_by")
          .eq("room_id", created.id)
          .eq("user_id", banned.userId)
          .single();
      expect(bannedMembershipError).toBeNull();
      expect(bannedMembership).toMatchObject({
        status: "banned",
        banned_by: host.userId,
      });
      expect(bannedMembership?.banned_at).toBeTruthy();

      const { data: leftMembership, error: leftMembershipError } = await admin
        .from("room_members")
        .select("status")
        .eq("room_id", created.id)
        .eq("user_id", leaver.userId)
        .maybeSingle();
      expect(leftMembershipError).toBeNull();
      expect(leftMembership).toBeNull();

      const hostLeave = await call(host, {
        op: "command",
        roomId: created.id,
        expectedVersion: afterLeave.version,
        command: { type: "leaveRoom" },
      });
      expect(hostLeave.response.status).toBe(409);
      expect(hostLeave.payload.error).toBe("HOST_LEAVE_FORBIDDEN");
    } finally {
      await deleteIfPresent(host, created.id);
    }
  }, 30_000);

  it("transfers authority atomically and requires host plus current version to delete", async () => {
    const [host, nextHost] = await Promise.all([
      anonymousIdentity(),
      anonymousIdentity(),
    ]);
    const created = await createRoom(host, "Host");

    await joinRoom(nextHost, created.code, "Next host");
    const beforeTransfer = await getRoom(host, created.id);
    const nonHostDelete = await call(nextHost, {
      op: "command",
      roomId: created.id,
      expectedVersion: beforeTransfer.version,
      command: { type: "deleteRoom" },
    });
    expect(nonHostDelete.response.status).toBe(403);
    expect(nonHostDelete.payload.error).toBe("NOT_HOST");

    const transferred = await commandAt(
      host,
      created.id,
      beforeTransfer.version,
      { type: "transferHost", nextHostId: nextHost.userId },
    );
    expect(transferred.hostId).toBe(nextHost.userId);

    const formerHostCommand = await call(host, {
      op: "command",
      roomId: created.id,
      expectedVersion: transferred.version,
      command: { type: "setLang", lang: "en" },
    });
    expect(formerHostCommand.response.status).toBe(403);
    expect(formerHostCommand.payload.error).toBe("NOT_HOST");

    const staleDelete = await call(nextHost, {
      op: "command",
      roomId: created.id,
      expectedVersion: beforeTransfer.version,
      command: { type: "deleteRoom" },
    });
    expect(staleDelete.response.status).toBe(409);
    expect(staleDelete.payload.error).toBe("ROOM_VERSION_CONFLICT");

    const deleted = await commandRaw(nextHost, created.id, {
      type: "deleteRoom",
    });
    expect(deleted).toEqual({ deleted: true });

    const raceRoom = await createRoom(host, "Race host");
    await joinRoom(nextHost, raceRoom.code, "Race successor");
    const raceVersion = (await getRoom(host, raceRoom.id)).version;
    const [transferRace, deleteRace] = await Promise.all([
      call(host, {
        op: "command",
        roomId: raceRoom.id,
        expectedVersion: raceVersion,
        command: { type: "transferHost", nextHostId: nextHost.userId },
      }),
      call(host, {
        op: "command",
        roomId: raceRoom.id,
        expectedVersion: raceVersion,
        command: { type: "deleteRoom" },
      }),
    ]);
    const successfulRaceOperations = [transferRace, deleteRace].filter(
      ({ response }) => response.status === 200,
    );
    expect(successfulRaceOperations).toHaveLength(1);
    if (transferRace.response.ok) {
      expect(deleteRace.response.status).toBe(409);
      await deleteIfPresent(nextHost, raceRoom.id);
    } else {
      expect(deleteRace.response.status).toBe(200);
    }
  }, 20_000);

  it("broadcasts state-free deletion and the API fallback observes the cascade", async () => {
    const [host, member] = await Promise.all([
      anonymousIdentity(),
      anonymousIdentity(),
    ]);
    const created = await createRoom(host, "Host");
    await joinRoom(member, created.code, "Member");

    const realtime = createClient(supabaseUrl, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    realtime.realtime.setAuth(member.token);
    const channel = realtime.channel(`room:${created.id}`, {
      config: { private: true },
    });
    let resolvePayload:
      | ((payload: Record<string, unknown>) => void)
      | undefined;
    const payloadPromise = new Promise<Record<string, unknown>>((resolve) => {
      resolvePayload = resolve;
    });
    await subscribe(channel, (message) => {
      resolvePayload?.(message.payload as Record<string, unknown>);
    });

    await commandRaw(host, created.id, { type: "deleteRoom" });
    const payload = await withTimeout(
      payloadPromise,
      "REALTIME_DELETE_TIMEOUT",
    );
    expect(payload.deleted).toBe(true);
    expect(payload).toHaveProperty("version");
    expect(payload).not.toHaveProperty("state");
    expect(JSON.stringify(payload)).not.toContain("players");
    await realtime.removeChannel(channel);

    expect(
      await success<null>(member, { op: "get", roomId: created.id }),
    ).toBeNull();

    const admin = adminClient();
    const cascade = await admin
      .from("room_members")
      .select("room_id", { count: "exact", head: true })
      .eq("room_id", created.id);
    expect(cascade.error).toBeNull();
    expect(cascade.count).toBe(0);
  }, 20_000);

  it("denies anonymous and authenticated publishable-key CRUD on raw rooms", async () => {
    const actor = await anonymousIdentity();
    const browsers = [
      createClient(supabaseUrl, publishableKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      }),
      createClient(supabaseUrl, publishableKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${actor.token}` } },
      }),
    ];

    for (const browser of browsers) {
      const read = await browser.from("rooms").select("*").limit(1);
      expect(read.error).not.toBeNull();

      const insert = await browser.from("rooms").insert({
        id: "forbidden-browser-write",
        code: "DENY1",
        host_id: actor.userId,
        visibility: "public",
        state: {},
        ui: {},
        version: 1,
      });
      expect(insert.error).not.toBeNull();

      const update = await browser
        .from("rooms")
        .update({ visibility: "private" })
        .eq("id", "forbidden-browser-write");
      expect(update.error).not.toBeNull();

      const removal = await browser
        .from("rooms")
        .delete()
        .eq("id", "forbidden-browser-write");
      expect(removal.error).not.toBeNull();
    }
  }, 15_000);
});

function adminClient() {
  return createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function anonymousIdentity(): Promise<Identity> {
  const client = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.session || !data.user) {
    throw error ?? new Error("ANONYMOUS_SESSION_MISSING");
  }
  return { token: data.session.access_token, userId: data.user.id };
}

async function createRoom(
  actor: Identity,
  name: string,
  visibility: "public" | "private" = "public",
): Promise<RoomSnapshot> {
  return success<RoomSnapshot>(actor, {
    op: "create",
    name,
    lang: "ar",
    visibility,
  });
}

async function joinRoom(
  actor: Identity,
  code: string,
  name: string,
  inviteToken?: string,
): Promise<RoomSnapshot> {
  return success<RoomSnapshot>(actor, {
    op: "join",
    code,
    name,
    ...(inviteToken ? { inviteToken } : {}),
  });
}

async function getRoom(actor: Identity, roomId: string): Promise<RoomSnapshot> {
  return success<RoomSnapshot>(actor, { op: "get", roomId });
}

async function command(
  actor: Identity,
  roomId: string,
  commandValue: RoomCommand,
): Promise<RoomSnapshot> {
  const current = await getRoom(actor, roomId);
  return commandAt(actor, roomId, current.version, commandValue);
}

async function commandAt(
  actor: Identity,
  roomId: string,
  expectedVersion: number,
  commandValue: RoomCommand,
): Promise<RoomSnapshot> {
  return success<RoomSnapshot>(actor, {
    op: "command",
    roomId,
    expectedVersion,
    command: commandValue,
  });
}

async function commandRaw(
  actor: Identity,
  roomId: string,
  commandValue: RoomCommand,
): Promise<RoomMutationResult> {
  const current = await getRoom(actor, roomId);
  return success<RoomMutationResult>(actor, {
    op: "command",
    roomId,
    expectedVersion: current.version,
    command: commandValue,
  });
}

async function deleteIfPresent(actor: Identity, roomId: string): Promise<void> {
  const current = await call(actor, { op: "get", roomId });
  if (!current.response.ok || !current.payload.data) {
    return;
  }
  const room = current.payload.data as RoomSnapshot;
  await call(actor, {
    op: "command",
    roomId,
    expectedVersion: room.version,
    command: { type: "deleteRoom" },
  });
}

async function success<T extends ApiData>(
  actor: Identity,
  body: Record<string, unknown>,
): Promise<T> {
  const result = await call(actor, body);
  expect(result.response.status).toBe(200);
  if (!("data" in result.payload)) {
    throw new Error(result.payload.error ?? "ROOM_RESPONSE_MISSING");
  }
  return result.payload.data as T;
}

async function call(actor: Identity, body: Record<string, unknown>) {
  const response = await handleRoomsRequest(
    new Request("https://game.example/api/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${actor.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );
  const payload = (await response.json()) as {
    data?: ApiData;
    error?: string;
  };
  return { response, payload };
}

async function subscribe(
  channel: ReturnType<ReturnType<typeof createClient>["channel"]>,
  onChange: (message: { payload: unknown }) => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("REALTIME_SUBSCRIBE_TIMEOUT")),
      8_000,
    );
    channel
      .on("broadcast", { event: "room_changed" }, onChange)
      .subscribe((status, error) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve();
        } else if (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });
  });
}

async function rejectedSubscriptionStatus(
  channel: ReturnType<ReturnType<typeof createClient>["channel"]>,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("REALTIME_REJECTION_TIMEOUT")),
      8_000,
    );
    channel.subscribe((status) => {
      if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
        clearTimeout(timeout);
        resolve(status);
      }
    });
  });
}

async function withTimeout<T>(promise: Promise<T>, code: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(code)), 8_000);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
