// @vitest-environment node

import { describe, expect, it } from "vitest";
import { startTestGame } from "../engine/codenames/testFixtures";
import { toRoomSnapshot } from "./snapshot";
import type { RoomRecord } from "./types";

describe("toRoomSnapshot", () => {
  it("never returns unrevealed identities to an operative", () => {
    const snapshot = toRoomSnapshot(makeRoom(), "p-red-op");

    expect(snapshot).not.toHaveProperty("state");
    expect(snapshot.view.board.every((card) => card.kind === null)).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('"kind":"assassin"');
  });

  it("returns the key to an authenticated spymaster", () => {
    const snapshot = toRoomSnapshot(makeRoom(), "p-red-sm");

    expect(snapshot.view.board.every((card) => card.kind !== null)).toBe(true);
    expect(snapshot.view.board.some((card) => card.kind === "assassin")).toBe(
      true,
    );
  });

  it("never gives a non-member raw state or unrevealed card kinds", () => {
    const snapshot = toRoomSnapshot(makeRoom(), "not-a-member");

    expect(snapshot).not.toHaveProperty("state");
    expect(snapshot.view.me).toBeNull();
    expect(snapshot.view.board.every((card) => card.kind === null)).toBe(true);
  });
});

function makeRoom(): RoomRecord {
  return {
    id: "test-room",
    code: "TESTROOM",
    hostId: "p-red-sm",
    visibility: "public",
    state: startTestGame(),
    ui: { votes: {}, clueLog: [], banners: [] },
    version: 8,
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:01.000Z",
  };
}
