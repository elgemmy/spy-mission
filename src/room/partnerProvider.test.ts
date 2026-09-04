import { describe, expect, it } from "vitest";
import { LocalRoomProvider } from "./localRoomProvider";

describe("Partner Mission room provider", () => {
  it("creates a private room with the creator as Mission Lead", async () => {
    const lead = new LocalRoomProvider("partner-lead-create");
    const created = await lead.create({
      mode: "partner",
      name: "Lead",
      lang: "en",
      visibility: "public",
    });

    expect(created.mode).toBe("partner");
    if (created.mode !== "partner") {
      throw new Error("PARTNER_ROOM_EXPECTED");
    }
    expect(created.visibility).toBe("private");
    expect(created.view.viewerRole).toBe("mission_lead");
    if (created.view.viewerRole !== "mission_lead") {
      throw new Error("MISSION_LEAD_VIEW_EXPECTED");
    }
    expect(created.view.board).toHaveLength(25);
    expect(countLeadKinds(created.view.board)).toEqual({
      target: 8,
      decoy: 16,
      trap: 1,
    });
    await lead.mutate(created.id, created.version, { type: "deleteRoom" });
  });

  it("binds one invited Field Agent identity and redacts its board", async () => {
    const lead = new LocalRoomProvider("partner-lead-claim");
    const agent = new LocalRoomProvider("partner-agent-claim");
    const second = new LocalRoomProvider("partner-second-claim");
    const created = await lead.create({
      mode: "partner",
      name: "Lead",
      lang: "en",
    });
    if (created.mode !== "partner" || !created.inviteToken) {
      throw new Error("PARTNER_INVITE_EXPECTED");
    }

    await expect(agent.resume(created.code)).resolves.toEqual({
      status: "join",
      code: created.code,
      mode: "partner",
    });
    const joined = await agent.claimPartnerSeat({
      code: created.code,
      name: "Cipher",
      inviteToken: created.inviteToken,
    });
    expect(joined.view.viewerRole).toBe("field_agent");
    if (joined.view.viewerRole !== "field_agent") {
      throw new Error("FIELD_AGENT_VIEW_EXPECTED");
    }
    expect(joined.view.fieldAgentName).toBe("Cipher");
    expect(joined.view.board.every((card) => !("kind" in card))).toBe(true);
    await expect(
      second.claimPartnerSeat({
        code: created.code,
        name: "Second",
        inviteToken: created.inviteToken,
      }),
    ).rejects.toThrow("FIELD_AGENT_SEAT_TAKEN");
    await expect(
      agent.claimPartnerSeat({
        code: created.code,
        name: "Cipher again",
        inviteToken: created.inviteToken,
      }),
    ).rejects.toThrow("WRONG_PHASE");

    const latest = await lead.load(created.id);
    if (!latest) {
      throw new Error("PARTNER_ROOM_EXPECTED");
    }
    await lead.mutate(latest.id, latest.version, { type: "deleteRoom" });
  });

  it("persists Signal, ordered locks, and authoritative resolution", async () => {
    const lead = new LocalRoomProvider("partner-lead-turn");
    const agent = new LocalRoomProvider("partner-agent-turn");
    const created = await lead.create({
      mode: "partner",
      name: "Lead",
      lang: "en",
    });
    if (created.mode !== "partner" || !created.inviteToken) {
      throw new Error("PARTNER_INVITE_EXPECTED");
    }
    const joined = await agent.claimPartnerSeat({
      code: created.code,
      name: "Cipher",
      inviteToken: created.inviteToken,
    });
    const signalled = await lead.mutate(created.id, joined.version, {
      type: "giveSignal",
      word: "orbit",
      count: 2,
    });
    if (!("id" in signalled) || signalled.mode !== "partner") {
      throw new Error("PARTNER_ROOM_EXPECTED");
    }
    const fieldTurn = await agent.load(created.id);
    if (
      fieldTurn?.mode !== "partner" ||
      fieldTurn.view.viewerRole !== "field_agent"
    ) {
      throw new Error("FIELD_AGENT_VIEW_EXPECTED");
    }
    const cardIds = fieldTurn.view.board.slice(0, 2).map((card) => card.id);
    const locked = await agent.mutate(created.id, fieldTurn.version, {
      type: "lockGuesses",
      cardIds,
      fieldNote: "Strongest first",
    });
    if (!("id" in locked) || locked.mode !== "partner") {
      throw new Error("PARTNER_ROOM_EXPECTED");
    }
    expect(locked.view.phase).toBe("locked");
    if (locked.view.viewerRole !== "field_agent") {
      throw new Error("FIELD_AGENT_VIEW_EXPECTED");
    }
    expect(locked.view.lockedCardIds).toEqual(cardIds);

    const resolved = await lead.mutate(created.id, locked.version, {
      type: "resolveLockedGuesses",
    });
    if (!("id" in resolved) || resolved.mode !== "partner") {
      throw new Error("PARTNER_ROOM_EXPECTED");
    }
    expect(["waiting_for_signal", "won", "lost"]).toContain(
      resolved.view.phase,
    );
    if (resolved.view.viewerRole !== "mission_lead") {
      throw new Error("MISSION_LEAD_VIEW_EXPECTED");
    }
    expect(resolved.view.previousTurn?.lockedCardIds).toEqual(cardIds);
    await lead.mutate(created.id, resolved.version, { type: "deleteRoom" });
  });
});

function countLeadKinds(
  board: Array<{ kind: "target" | "decoy" | "trap" }>,
): Record<"target" | "decoy" | "trap", number> {
  return board.reduce(
    (counts, card) => ({ ...counts, [card.kind]: counts[card.kind] + 1 }),
    { target: 0, decoy: 0, trap: 0 },
  );
}
