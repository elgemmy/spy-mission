// @vitest-environment node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../../../supabase/migrations/0005_partner_mission.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("0005 Partner Mission migration", () => {
  it("adds a constrained mode while preserving classic as the upgrade default", () => {
    expect(migration).toContain(
      "add column if not exists mode text not null default 'classic'",
    );
    expect(migration).toContain("mode in ('classic', 'partner')");
    expect(migration).toContain(
      "check (mode <> 'partner' or visibility = 'private')",
    );
  });

  it("keeps Partner membership identity-bound and limited to one agent", () => {
    const assertion = functionBody("private", "assert_room_membership_state");
    expect(assertion).toContain("p_state->>'mode' <> 'partner'");
    expect(assertion).toContain("p_state->'missionlead'->>'id'");
    expect(assertion).toContain("p_state->'fieldagent'->>'id'");
    expect(assertion).toContain("status = 'active'");

    const join = functionBody("public", "server_join_room");
    expect(join).toContain("for update");
    expect(join).toContain("p_expected_version");
    expect(join).toContain("current_room.mode = 'classic'");
    expect(join).toContain("p_partner_claim");
    expect(join).toMatch(/member_status = 'active'[\s\S]*wrong_phase/);
    expect(join).toContain("message = 'field_agent_seat_taken'");
    expect(join).toMatch(/count\(\*\)[\s\S]*>= 2/);
  });

  it("keeps changed RPCs service-role-only", () => {
    for (const name of ["server_create_room", "server_join_room"]) {
      expect(migration).toMatch(
        new RegExp(`revoke execute on function public\\.${name}`),
      );
      expect(migration).toMatch(
        new RegExp(`grant execute on function public\\.${name}`),
      );
    }
    expect(migration).not.toMatch(/grant execute[\s\S]*to authenticated/i);
  });
});

function functionBody(schema: string, name: string): string {
  const start = migration.indexOf(`function ${schema}.${name}(`);
  if (start < 0) {
    throw new Error(`Missing ${schema}.${name}`);
  }
  const end = migration.indexOf("$$;", start);
  if (end < 0) {
    throw new Error(`Unterminated ${schema}.${name}`);
  }
  return migration.slice(start, end + 3).toLowerCase();
}
