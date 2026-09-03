import { describe, expect, it } from "vitest";
import { LocalRoomProvider } from "./localRoomProvider";
import type { RoomSnapshot } from "./types";

describe("LocalRoomProvider lifecycle preview", () => {
  it("resumes by identity and ignores a submitted name for an active member", async () => {
    const host = new LocalRoomProvider("local-host-resume");
    const guest = new LocalRoomProvider("local-guest-resume");
    const created = await host.create({ name: "Same", lang: "ar" });

    expect(await guest.resume(created.code)).toEqual({
      status: "join",
      code: created.code,
    });
    await guest.join({ code: created.code, name: "Same" });
    const joinedAgain = await guest.join({
      code: created.code,
      name: "Replacement",
    });

    expect(joinedAgain.view.me?.id).toBe("local-guest-resume");
    expect(playerName(joinedAgain, "local-guest-resume")).toBe("Same");
    expect(
      joinedAgain.view.players.filter((player) => player.name === "Same"),
    ).toHaveLength(2);
    await host.mutate(created.id, joinedAgain.version, { type: "deleteRoom" });
  });

  it("leaves permanently without banning and can later rejoin", async () => {
    const host = new LocalRoomProvider("local-host-leave");
    const guest = new LocalRoomProvider("local-guest-leave");
    const created = await host.create({ name: "Host", lang: "ar" });
    const joined = await guest.join({ code: created.code, name: "Guest" });

    await expect(
      guest.mutate(created.id, joined.version, { type: "leaveRoom" }),
    ).resolves.toEqual({ left: true });
    await expect(guest.load(created.id)).resolves.toBeNull();

    const hostView = await host.load(created.id);
    expect(
      hostView?.view.players.some(
        (player) => player.id === "local-guest-leave",
      ),
    ).toBe(false);
    const rejoined = await guest.join({ code: created.code, name: "Returned" });
    expect(playerName(rejoined, "local-guest-leave")).toBe("Returned");
    await host.mutate(created.id, rejoined.version, { type: "deleteRoom" });
  });

  it("bans an identity while preserving the host room", async () => {
    const host = new LocalRoomProvider("local-host-ban");
    const guest = new LocalRoomProvider("local-guest-ban");
    const created = await host.create({ name: "Host", lang: "ar" });
    const joined = await guest.join({ code: created.code, name: "Guest" });

    const afterBan = await host.mutate(created.id, joined.version, {
      type: "banPlayer",
      targetPlayerId: "local-guest-ban",
    });
    if (!("id" in afterBan)) {
      throw new Error("ROOM_SNAPSHOT_EXPECTED");
    }
    expect(
      afterBan.view.players.some((player) => player.id === "local-guest-ban"),
    ).toBe(false);
    await expect(guest.load(created.id)).resolves.toBeNull();
    await expect(guest.resume(created.code)).rejects.toThrow("ROOM_BANNED");
    await expect(
      guest.join({ code: created.code, name: "Return" }),
    ).rejects.toThrow("ROOM_BANNED");
    await host.mutate(created.id, afterBan.version, { type: "deleteRoom" });
  });

  it("keeps one invite token valid for the room lifetime", async () => {
    const host = new LocalRoomProvider("local-host-invite");
    const oldLinkGuest = new LocalRoomProvider("local-old-link");
    const newLinkGuest = new LocalRoomProvider("local-new-link");
    const created = await host.create({
      name: "Host",
      lang: "ar",
      visibility: "private",
    });
    const originalToken = host.getInviteToken(created.id);
    expect(originalToken).toBeTruthy();

    const publicResult = await host.mutate(created.id, created.version, {
      type: "setVisibility",
      visibility: "public",
    });
    const publicRoom = asSnapshot(publicResult);
    const privateResult = await host.mutate(created.id, publicRoom.version, {
      type: "setVisibility",
      visibility: "private",
    });
    const privateRoom = asSnapshot(privateResult);
    expect(privateRoom.visibility).toBe("private");
    expect(host.getInviteToken(created.id)).toBe(originalToken);
    await oldLinkGuest.join({
      code: created.code,
      name: "Old link",
      inviteToken: originalToken ?? undefined,
    });

    const newest = await newLinkGuest.join({
      code: created.code,
      name: "New link",
      inviteToken: originalToken ?? undefined,
    });
    await host.mutate(created.id, newest.version, { type: "deleteRoom" });
  });
});

function playerName(room: RoomSnapshot, playerId: string): string | undefined {
  return room.view.players.find((player) => player.id === playerId)?.name;
}

function asSnapshot(
  result: Awaited<ReturnType<LocalRoomProvider["mutate"]>>,
): RoomSnapshot {
  if (!("id" in result)) {
    throw new Error("ROOM_SNAPSHOT_EXPECTED");
  }
  return result;
}
