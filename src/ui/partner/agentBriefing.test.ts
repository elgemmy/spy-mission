import { describe, expect, it } from "vitest";
import { buildAgentBriefing } from "./agentBriefing";

describe("buildAgentBriefing", () => {
  it("includes the actual invitation and the complete public tool workflow", () => {
    const inviteUrl =
      "https://spymission.dev/play/?room=ROOMCODE#invite=example-token";

    const briefing = buildAgentBriefing(inviteUrl);

    expect(briefing).toContain(inviteUrl);
    expect(briefing).toContain("You are the Field Agent");
    expect(briefing).toContain("choose_name");
    expect(briefing).toContain("inspect_mission");
    expect(briefing).toContain("submit_guesses");
    expect(briefing).toContain("stable IDs");
    expect(briefing).toContain("strongest-first");
    expect(briefing).toContain("max_guesses");
    expect(briefing).toContain("Mission Lead is acting");
    expect(briefing).toContain("After each reveal");
    expect(briefing).toContain("hidden card classifications");
    expect(briefing).toContain("Do not replace them with DOM scraping");
  });

  it("rejects an empty invitation", () => {
    expect(() => buildAgentBriefing("   ")).toThrow(
      "A Field Agent invitation URL is required.",
    );
  });
});
