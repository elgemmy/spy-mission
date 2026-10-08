// @vitest-environment node

import { describe, expect, it } from "vitest";
import { buildAgentBriefing } from "./agentBriefing";

describe("buildAgentBriefing", () => {
  it("includes the trimmed invitation and public tool identifiers", () => {
    const inviteUrl =
      "https://spymission.dev/play/?room=ROOMCODE#invite=example-token";

    const briefing = buildAgentBriefing(`  ${inviteUrl}  `);

    expect(briefing).toContain(inviteUrl);
    expect(briefing).not.toContain(`  ${inviteUrl}  `);
    expect(briefing).toContain("choose_name");
    expect(briefing).toContain("inspect_mission");
    expect(briefing).toContain("submit_guesses");
    expect(briefing).toContain("max_guesses");
  });

  it("rejects an empty invitation", () => {
    expect(() => buildAgentBriefing("   ")).toThrow(
      "A Field Agent invitation URL is required.",
    );
  });
});
