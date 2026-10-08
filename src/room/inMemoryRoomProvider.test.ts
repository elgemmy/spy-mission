import { describe, expect, it } from "vitest";
import { InMemoryRoomProvider } from "./inMemoryRoomProvider";
import { createRoomRecord } from "./session";
import type { RoomRecord, SharedRoomRecord } from "./types";

describe("InMemoryRoomProvider", () => {
  it("rejects stale saves and never resurrects a deleted room", async () => {
    const provider = new InMemoryRoomProvider();
    const room = makeRoom();
    await provider.create(room);
    const accepted = { ...room, version: room.version + 1 };
    await provider.save(accepted, room.version);
    await expect(
      provider.save({ ...room, version: 99 }, room.version),
    ).rejects.toThrow("ROOM_VERSION_CONFLICT");
    expect((await provider.load(room.id))?.version).toBe(accepted.version);
    await provider.delete(room.id);
    await expect(provider.save(accepted, accepted.version)).rejects.toThrow(
      "ROOM_VERSION_CONFLICT",
    );
    await expect(provider.load(room.id)).resolves.toBeNull();
  });

  it("does not persist local rooms across provider instances", async () => {
    const room = makeRoom();
    const first = new InMemoryRoomProvider();

    await first.create(room);

    const second = new InMemoryRoomProvider();
    await expect(second.load(room.id)).resolves.toBeNull();
    await expect(second.loadByCode(room.code)).resolves.toBeNull();
    expect(window.localStorage.getItem("codenames.localRooms.v1")).toBeNull();
  });

  it("notifies subscribers when a room is deleted", async () => {
    const room = makeRoom();
    const provider = new InMemoryRoomProvider();
    await provider.create(room);

    const changes: Array<SharedRoomRecord | null> = [];
    provider.subscribe(room.id, (next) => changes.push(next));

    await provider.delete(room.id);

    expect(changes.at(-1)).toBeNull();
  });
});

function makeRoom(): RoomRecord {
  return createRoomRecord({
    id: "room-provider-test",
    code: "TST42",
    hostId: "host",
    hostName: "Host",
    lang: "ar",
    now: "2026-05-31T00:00:00.000Z",
  });
}
