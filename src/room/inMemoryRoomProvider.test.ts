import { afterEach, describe, expect, it } from "vitest";
import { InMemoryRoomProvider } from "./inMemoryRoomProvider";
import { createRoomRecord } from "./session";
import type { RoomRecord } from "./types";

const STORAGE_KEY = "codenames.localRooms.v1";

afterEach(() => {
  window.localStorage.removeItem(STORAGE_KEY);
});

describe("InMemoryRoomProvider", () => {
  it("persists local rooms across provider instances", async () => {
    const room = makeRoom();
    const first = new InMemoryRoomProvider();

    await first.create(room);

    const second = new InMemoryRoomProvider();
    await expect(second.load(room.id)).resolves.toEqual(room);
    await expect(second.loadByCode(room.code)).resolves.toEqual(room);
  });

  it("notifies subscribers when a room is deleted", async () => {
    const room = makeRoom();
    const provider = new InMemoryRoomProvider();
    await provider.create(room);

    const changes: Array<RoomRecord | null> = [];
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
