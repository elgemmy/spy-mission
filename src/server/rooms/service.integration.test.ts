// @vitest-environment node

import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";
import type {
  RoomCommand,
  RoomMutationResult,
  PartnerRoomSnapshot,
  RoomSnapshot,
  SharedRoomSnapshot,
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
const databaseUrl = process.env.SUPABASE_DB_URL ?? "";

interface Identity {
  token: string;
  userId: string;
}

type ApiData =
  | SharedRoomSnapshot
  | RoomMutationResult
  | ResumeRoomResult
  | null;

describe.skipIf(!enabled).sequential("secure multiplayer integration", () => {
  afterAll(() => {
    resetAdminClientForTests();
  });

  it("keeps identity separate from mutable and duplicate display names", async () => {
    const [host, first, second, privateJoiner] = await Promise.all([
      anonymousIdentity(),
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
      if (resumed.room.mode === "partner") {
        throw new Error("CLASSIC_ROOM_EXPECTED");
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
      expect(created.inviteToken).toBeTruthy();
      expect(firstPrivateTransition.inviteToken).toBeUndefined();
      await joinRoom(
        privateJoiner,
        created.code,
        "Stable invite",
        created.inviteToken,
      );
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
      const sameIdentityJoins = await Promise.all([
        joinRoom(sameBrowser, created.code, "One tab"),
        joinRoom(sameBrowser, created.code, "Other tab"),
      ]);
      expect(sameIdentityJoins.map((snapshot) => snapshot.view.me?.id)).toEqual(
        [sameBrowser.userId, sameBrowser.userId],
      );
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
      expect(
        (await rawMembers(created.id)).filter(
          (member) => member.user_id === sameBrowser.userId,
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

  it("fails closed when active membership persistently lacks a player", async () => {
    const [host, member] = await Promise.all([
      anonymousIdentity(),
      anonymousIdentity(),
    ]);
    const created = await createRoom(host, "Host");

    try {
      await joinRoom(member, created.code, "Member");
      removePlayerFromRoom(created.id, member.userId);

      const result = await call(member, {
        op: "join",
        code: created.code,
        name: "Member",
      });

      expect(result.response.status).toBe(503);
      expect(result.payload.error).toBe("ROOM_MEMBERSHIP_INVALID");
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

      const afterActiveBan = await command(host, created.id, {
        type: "banPlayer",
        targetPlayerId: blueOperative.userId,
      });
      expect(
        afterActiveBan.view.players.some(
          (player) => player.id === blueOperative.userId,
        ),
      ).toBe(false);
      expect(
        await success<null>(blueOperative, {
          op: "get",
          roomId: created.id,
        }),
      ).toBeNull();
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

      await joinRoom(banned, created.code, "Banned later", initialToken);
      await joinRoom(leaver, created.code, "Leaving", initialToken);

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
          inviteToken: initialToken,
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

  it("denies every server RPC to anonymous and authenticated browser roles", async () => {
    const actor = await anonymousIdentity();
    const probes = serverRpcProbes(actor.userId);
    expect([...new Set(probes.map((probe) => probe.name))].sort()).toEqual(
      publicServerRpcNames(),
    );
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
      for (const probe of probes) {
        const result = await browser.rpc(probe.name, probe.args);
        expect(result.error?.code, probe.name).toBe("42501");
        expect(result.error?.message, probe.name).toMatch(/permission denied/i);
      }
    }
  }, 20_000);

  it("enforces the 12-player limit under concurrent joins", async () => {
    const host = await anonymousIdentity();
    const joiners = await Promise.all(
      Array.from({ length: 12 }, () => anonymousIdentity()),
    );
    const created = await createRoom(host, "Host");

    try {
      for (const [index, joiner] of joiners.slice(0, 10).entries()) {
        await joinRoom(joiner, created.code, `Player ${index + 1}`);
      }
      const contenders = await Promise.all(
        joiners.slice(10).map((joiner, index) =>
          call(joiner, {
            op: "join",
            code: created.code,
            name: `Contender ${index + 1}`,
          }),
        ),
      );
      expect(contenders.filter(({ response }) => response.ok)).toHaveLength(1);
      const denied = contenders.find(({ response }) => !response.ok);
      expect(denied?.response.status).toBe(409);
      expect(denied?.payload.error).toBe("ROOM_FULL");

      const current = await getRoom(host, created.id);
      expect(current.view.players).toHaveLength(12);
      const memberships = await adminClient()
        .from("room_members")
        .select("room_id", { count: "exact", head: true })
        .eq("room_id", created.id)
        .eq("status", "active");
      expect(memberships.error).toBeNull();
      expect(memberships.count).toBe(12);
    } finally {
      await deleteIfPresent(host, created.id);
    }
  }, 40_000);

  it("does not churn versions for authorized or malicious no-op commands", async () => {
    const [host, member] = await Promise.all([
      anonymousIdentity(),
      anonymousIdentity(),
    ]);
    const created = await createRoom(host, "Host");
    await joinRoom(member, created.code, "Member");

    try {
      const before = await getRoom(host, created.id);
      const unchanged = await commandAt(host, created.id, before.version, {
        type: "setLang",
        lang: "ar",
      });
      expect(unchanged.version).toBe(before.version);

      const unauthorized = await call(member, {
        op: "command",
        roomId: created.id,
        expectedVersion: before.version,
        command: { type: "setVisibility", visibility: "public" },
      });
      expect(unauthorized.response.status).toBe(403);
      expect(unauthorized.payload.error).toBe("NOT_HOST");

      const illegal = await call(member, {
        op: "command",
        roomId: created.id,
        expectedVersion: before.version,
        command: { type: "clearVote" },
      });
      expect(illegal.response.status).toBe(409);
      expect(illegal.payload.error).toBe("WRONG_PHASE");
      expect((await getRoom(host, created.id)).version).toBe(before.version);
    } finally {
      await deleteIfPresent(host, created.id);
    }
  }, 20_000);

  it("restricts Auth deletion until room lifecycle references are removed", async () => {
    if (!databaseUrl) {
      throw new Error("SUPABASE_DB_URL_REQUIRED");
    }
    const [host, active, banned] = await Promise.all([
      anonymousIdentity(),
      anonymousIdentity(),
      anonymousIdentity(),
    ]);
    const created = await createRoom(host, "Host");
    await joinRoom(active, created.code, "Active");
    await joinRoom(banned, created.code, "Banned");
    await command(host, created.id, {
      type: "banPlayer",
      targetPlayerId: banned.userId,
    });

    try {
      const beforeRoom = await rawRoom(created.id);
      const beforeMembers = await rawMembers(created.id);
      for (const identity of [active, banned, host]) {
        expectAuthDeleteFailure(identity.userId, "23503");
      }

      expect(await rawRoom(created.id)).toEqual(beforeRoom);
      expect(await rawMembers(created.id)).toEqual(beforeMembers);
      expect(beforeRoom.host_id).toBe(host.userId);
      expect(beforeRoom.state.players).toHaveProperty(host.userId);
      expect(beforeRoom.state.players).toHaveProperty(active.userId);
      expect(beforeRoom.state.players).not.toHaveProperty(banned.userId);
      expect(
        beforeMembers.find((member) => member.user_id === banned.userId)
          ?.status,
      ).toBe("banned");

      await commandRaw(active, created.id, { type: "leaveRoom" });
      deleteAuthUser(active.userId);
      await commandRaw(host, created.id, { type: "deleteRoom" });
      deleteAuthUser(banned.userId);
      deleteAuthUser(host.userId);
    } finally {
      await deleteIfPresent(host, created.id);
    }
  }, 30_000);

  it("runs the identity-bound Partner Mission server path without hidden-state leaks", async () => {
    const [lead, first, second] = await Promise.all([
      anonymousIdentity(),
      anonymousIdentity(),
      anonymousIdentity(),
    ]);
    const created = await success<PartnerRoomSnapshot>(lead, {
      op: "create",
      name: "Mission Lead",
      lang: "en",
      visibility: "public",
      mode: "partner",
    });
    expect(created.mode).toBe("partner");
    expect(created.visibility).toBe("private");
    expect(created.view.viewerRole).toBe("mission_lead");
    expect(created.inviteToken).toBeTruthy();
    if (created.view.viewerRole !== "mission_lead" || !created.inviteToken) {
      throw new Error("PARTNER_LEAD_VIEW_EXPECTED");
    }
    expect(
      created.view.board.filter((card) => card.kind === "target"),
    ).toHaveLength(8);
    expect(
      created.view.board.filter((card) => card.kind === "decoy"),
    ).toHaveLength(16);
    expect(
      created.view.board.filter((card) => card.kind === "trap"),
    ).toHaveLength(1);

    try {
      expect(
        await success<ResumeRoomResult>(first, {
          op: "resume",
          code: created.code,
        }),
      ).toEqual({ status: "join", code: created.code, mode: "partner" });

      const denied = await call(first, {
        op: "claimPartnerSeat",
        code: created.code,
        name: "Cipher",
        inviteToken: "x".repeat(43),
      });
      expect(denied.response.status).toBe(403);
      expect(denied.payload.error).toBe("ROOM_INVITE_INVALID");

      const contenders = await Promise.all([
        call(first, {
          op: "claimPartnerSeat",
          code: created.code,
          name: "Cipher",
          inviteToken: created.inviteToken,
        }),
        call(first, {
          op: "claimPartnerSeat",
          code: created.code,
          name: "Cipher duplicate request",
          inviteToken: created.inviteToken,
        }),
      ]);
      const winner = first;
      const loser = second;
      expect(contenders.filter(({ response }) => response.ok)).toHaveLength(1);
      const rejected = contenders.find(({ response }) => !response.ok);
      expect(rejected?.response.status).toBe(409);
      expect(rejected?.payload.error).toBe("WRONG_PHASE");

      const occupied = await call(second, {
        op: "claimPartnerSeat",
        code: created.code,
        name: "Vector",
        inviteToken: created.inviteToken,
      });
      expect(occupied.response.status).toBe(409);
      expect(occupied.payload.error).toBe("FIELD_AGENT_SEAT_TAKEN");

      const field = await success<PartnerRoomSnapshot>(winner, {
        op: "get",
        roomId: created.id,
      });
      expect(field.view.viewerRole).toBe("field_agent");
      if (field.view.viewerRole !== "field_agent") {
        throw new Error("PARTNER_FIELD_VIEW_EXPECTED");
      }
      expect(field.view.board.every((card) => !("kind" in card))).toBe(true);
      expect(JSON.stringify(field.view.board)).not.toMatch(
        /"(?:kind|result)":/,
      );
      expect(
        await success<ResumeRoomResult>(winner, {
          op: "resume",
          code: created.code,
        }),
      ).toMatchObject({ status: "active" });
      expect(
        await success<null>(loser, { op: "get", roomId: created.id }),
      ).toBeNull();

      const leadBeforeSignal = await success<PartnerRoomSnapshot>(lead, {
        op: "get",
        roomId: created.id,
      });
      const signalled = await success<PartnerRoomSnapshot>(lead, {
        op: "command",
        roomId: created.id,
        expectedVersion: leadBeforeSignal.version,
        command: { type: "giveSignal", word: "orbit", count: 2 },
      });
      expect(signalled.view.phase).toBe("field_agent_turn");

      const fieldTurn = await success<PartnerRoomSnapshot>(winner, {
        op: "get",
        roomId: created.id,
      });
      if (fieldTurn.view.viewerRole !== "field_agent") {
        throw new Error("PARTNER_FIELD_VIEW_EXPECTED");
      }
      const cardIds = fieldTurn.view.board.slice(0, 2).map((card) => card.id);
      const locked = await success<PartnerRoomSnapshot>(winner, {
        op: "command",
        roomId: created.id,
        expectedVersion: fieldTurn.version,
        command: { type: "lockGuesses", cardIds, fieldNote: "Strongest first" },
      });
      expect(locked.view.phase).toBe("locked");
      if (locked.view.viewerRole !== "field_agent") {
        throw new Error("PARTNER_FIELD_VIEW_EXPECTED");
      }
      expect(locked.view.lockedCardIds).toEqual(cardIds);
      expect(JSON.stringify(locked.view.board)).not.toMatch(
        /"(?:kind|result)":/,
      );

      const repeated = await call(winner, {
        op: "command",
        roomId: created.id,
        expectedVersion: locked.version,
        command: { type: "lockGuesses", cardIds },
      });
      expect(repeated.response.status).toBe(409);
      expect(repeated.payload.error).toBe("WRONG_PHASE");

      const resolved = await success<PartnerRoomSnapshot>(lead, {
        op: "command",
        roomId: created.id,
        expectedVersion: locked.version,
        command: { type: "resolveLockedGuesses" },
      });
      expect(["waiting_for_signal", "won", "lost"]).toContain(
        resolved.view.phase,
      );
    } finally {
      await deleteIfPresent(lead, created.id);
    }
  }, 30_000);

  it("persists the same Partner reveal sequence for both roles across success, Decoy, and Trap turns", async () => {
    const [lead, agent] = await Promise.all([
      anonymousIdentity(),
      anonymousIdentity(),
    ]);
    const created = await success<PartnerRoomSnapshot>(lead, {
      op: "create",
      name: "Mission Lead",
      lang: "en",
      mode: "partner",
    });
    if (!created.inviteToken) {
      throw new Error("PARTNER_INVITE_EXPECTED");
    }

    try {
      await success<PartnerRoomSnapshot>(agent, {
        op: "claimPartnerSeat",
        code: created.code,
        name: "Cipher",
        inviteToken: created.inviteToken,
      });

      const turns = [
        {
          kind: "target" as const,
          expectedPhase: "waiting_for_signal",
          stoppedBy: "guesses_exhausted",
        },
        {
          kind: "decoy" as const,
          expectedPhase: "waiting_for_signal",
          stoppedBy: "decoy",
        },
        {
          kind: "trap" as const,
          expectedPhase: "lost",
          stoppedBy: "trap",
        },
      ];

      for (const [index, turn] of turns.entries()) {
        const beforeSignal = await success<PartnerRoomSnapshot>(lead, {
          op: "get",
          roomId: created.id,
        });
        if (beforeSignal.view.viewerRole !== "mission_lead") {
          throw new Error("PARTNER_LEAD_VIEW_EXPECTED");
        }
        const cardId = beforeSignal.view.board.find(
          (card) => card.kind === turn.kind && !card.revealed,
        )?.id;
        if (!cardId) {
          throw new Error(`PARTNER_${turn.kind.toUpperCase()}_EXPECTED`);
        }
        await success<PartnerRoomSnapshot>(lead, {
          op: "command",
          roomId: created.id,
          expectedVersion: beforeSignal.version,
          command: { type: "giveSignal", word: `signal${index}`, count: 1 },
        });
        const agentTurn = await success<PartnerRoomSnapshot>(agent, {
          op: "get",
          roomId: created.id,
        });
        const locked = await success<PartnerRoomSnapshot>(agent, {
          op: "command",
          roomId: created.id,
          expectedVersion: agentTurn.version,
          command: { type: "lockGuesses", cardIds: [cardId] },
        });
        const resolved = await success<PartnerRoomSnapshot>(lead, {
          op: "command",
          roomId: created.id,
          expectedVersion: locked.version,
          command: { type: "resolveLockedGuesses" },
        });
        const duplicate = await success<PartnerRoomSnapshot>(lead, {
          op: "command",
          roomId: created.id,
          expectedVersion: locked.version,
          command: { type: "resolveLockedGuesses" },
        });
        const agentDuplicate = await call(agent, {
          op: "command",
          roomId: created.id,
          expectedVersion: locked.version,
          command: { type: "resolveLockedGuesses" },
        });
        const fieldResolved = await success<PartnerRoomSnapshot>(agent, {
          op: "get",
          roomId: created.id,
        });
        if (
          resolved.view.viewerRole !== "mission_lead" ||
          duplicate.view.viewerRole !== "mission_lead" ||
          fieldResolved.view.viewerRole !== "field_agent"
        ) {
          throw new Error("PARTNER_RESOLVED_VIEWS_EXPECTED");
        }

        expect(resolved.view.phase).toBe(turn.expectedPhase);
        expect(resolved.view.previousTurn).toMatchObject({
          lockedCardIds: [cardId],
          reveals: [{ cardId, result: turn.kind }],
          stoppedBy: turn.stoppedBy,
        });
        expect(fieldResolved.view.previousTurn).toEqual(
          resolved.view.previousTurn,
        );
        expect(duplicate.version).toBe(resolved.version);
        expect(duplicate.view.previousTurn).toEqual(resolved.view.previousTurn);
        expect(agentDuplicate.response.status).toBe(409);
        expect(agentDuplicate.payload.error).toBe("ROOM_VERSION_CONFLICT");
      }
    } finally {
      await deleteIfPresent(lead, created.id);
    }
  }, 30_000);

  it("serializes competing Partner identities so exactly one claims the seat", async () => {
    const [lead, first, second] = await Promise.all([
      anonymousIdentity(),
      anonymousIdentity(),
      anonymousIdentity(),
    ]);
    const created = await success<PartnerRoomSnapshot>(lead, {
      op: "create",
      name: "Mission Lead",
      lang: "en",
      mode: "partner",
    });
    if (!created.inviteToken) {
      throw new Error("PARTNER_INVITE_EXPECTED");
    }

    try {
      const contenders = await Promise.all(
        [first, second].map((actor, index) =>
          call(actor, {
            op: "claimPartnerSeat",
            code: created.code,
            name: index === 0 ? "Cipher" : "Vector",
            inviteToken: created.inviteToken,
          }),
        ),
      );
      expect(contenders.filter(({ response }) => response.ok)).toHaveLength(1);
      expect(
        contenders.find(({ response }) => !response.ok)?.payload.error,
      ).toBe("FIELD_AGENT_SEAT_TAKEN");

      const winner = contenders[0]!.response.ok ? first : second;
      const loser = winner === first ? second : first;
      const members = await rawMembers(created.id);
      expect(members).toHaveLength(2);
      expect(members.map(({ user_id }) => user_id)).toEqual(
        expect.arrayContaining([lead.userId, winner.userId]),
      );
      expect(members.map(({ user_id }) => user_id)).not.toContain(loser.userId);
      expect(
        await success<null>(loser, { op: "get", roomId: created.id }),
      ).toBeNull();
    } finally {
      await deleteIfPresent(lead, created.id);
    }
  }, 20_000);
});

function serverRpcProbes(
  userId: string,
): Array<{ name: string; args: Record<string, unknown> }> {
  const state = {
    roomId: "forbidden-room-probe",
    lang: "ar",
    phase: "lobby",
    players: {
      [userId]: { name: "Probe", team: "red", role: "operative" },
    },
    board: [],
    turn: "red",
    startingTeam: "red",
    clue: null,
    guessesMadeThisTurn: 0,
    winner: null,
  };
  const ui = { votes: {}, clueLog: [], banners: [] };
  const now = "2026-09-03T00:00:00.000Z";
  return [
    {
      name: "server_create_room",
      args: {
        p_id: "forbidden-room-probe",
        p_code: "DENY1",
        p_host_id: userId,
        p_visibility: "public",
        p_state: state,
        p_ui: ui,
        p_version: 1,
        p_created_at: now,
        p_updated_at: now,
        p_invite_hash: "0".repeat(64),
        p_mode: "classic",
      },
    },
    {
      name: "server_join_room",
      args: {
        p_room_id: "forbidden-room-probe",
        p_user_id: userId,
        p_state: state,
        p_ui: ui,
        p_expected_version: 1,
        p_updated_at: now,
        p_invite_hash: null,
        p_partner_claim: false,
      },
    },
    {
      name: "server_update_room",
      args: {
        p_room_id: "forbidden-room-probe",
        p_actor_id: userId,
        p_host_id: userId,
        p_visibility: "public",
        p_state: state,
        p_ui: ui,
        p_expected_version: 1,
        p_updated_at: now,
        p_new_invite_hash: null,
      },
    },
    {
      name: "server_leave_room",
      args: {
        p_room_id: "forbidden-room-probe",
        p_actor_id: userId,
        p_state: state,
        p_ui: ui,
        p_expected_version: 1,
        p_updated_at: now,
      },
    },
    {
      name: "server_ban_room_member",
      args: {
        p_room_id: "forbidden-room-probe",
        p_actor_id: userId,
        p_target_user_id: userId,
        p_state: state,
        p_ui: ui,
        p_expected_version: 1,
        p_updated_at: now,
      },
    },
    {
      name: "server_delete_room",
      args: {
        p_room_id: "forbidden-room-probe",
        p_actor_id: userId,
        p_expected_version: 1,
      },
    },
  ];
}

async function rawRoom(roomId: string): Promise<{
  host_id: string;
  state: { players: Record<string, unknown> };
  version: number;
}> {
  const { data, error } = await adminClient()
    .from("rooms")
    .select("host_id,state,version")
    .eq("id", roomId)
    .single();
  expect(error).toBeNull();
  return data as {
    host_id: string;
    state: { players: Record<string, unknown> };
    version: number;
  };
}

async function rawMembers(
  roomId: string,
): Promise<Array<{ user_id: string; status: string }>> {
  const { data, error } = await adminClient()
    .from("room_members")
    .select("user_id,status")
    .eq("room_id", roomId)
    .order("user_id");
  expect(error).toBeNull();
  return (data ?? []) as Array<{ user_id: string; status: string }>;
}

function removePlayerFromRoom(roomId: string, userId: string): void {
  if (
    !/^room-[0-9a-f-]{36}$/i.test(roomId) ||
    !/^[0-9a-f-]{36}$/i.test(userId)
  ) {
    throw new Error("INVALID_TEST_ROOM_OR_USER_ID");
  }
  const result = spawnSync(
    "psql",
    [
      databaseUrl,
      "--set=ON_ERROR_STOP=1",
      "--command",
      `update public.rooms set state = state #- array['players', '${userId}'] where id = '${roomId}'`,
    ],
    { encoding: "utf8" },
  );
  expect(result.status).toBe(0);
}

function expectAuthDeleteFailure(userId: string, sqlState: string): void {
  const result = runAuthDelete(userId);
  expect(result.status).not.toBe(0);
  expect(`${result.stdout}\n${result.stderr}`).toContain(sqlState);
}

function deleteAuthUser(userId: string): void {
  const result = runAuthDelete(userId);
  expect(`${result.stdout}\n${result.stderr}`).toBeTruthy();
  expect(result.status).toBe(0);
}

function runAuthDelete(userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    throw new Error("INVALID_TEST_USER_ID");
  }
  return spawnSync(
    "psql",
    [
      databaseUrl,
      "--set=ON_ERROR_STOP=1",
      "--set=VERBOSITY=verbose",
      "--command",
      `delete from auth.users where id = '${userId}'::uuid`,
    ],
    { encoding: "utf8" },
  );
}

function publicServerRpcNames(): string[] {
  if (!databaseUrl) {
    throw new Error("SUPABASE_DB_URL_REQUIRED");
  }
  const result = spawnSync(
    "psql",
    [
      databaseUrl,
      "--tuples-only",
      "--no-align",
      "--set=ON_ERROR_STOP=1",
      "--command",
      "select distinct proname from pg_proc where pronamespace = 'public'::regnamespace and proname ~ '^server_' order by proname",
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`SERVER_RPC_DISCOVERY_FAILED: ${result.stderr}`);
  }
  return result.stdout
    .split("\n")
    .map((name) => name.trim())
    .filter(Boolean);
}

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
