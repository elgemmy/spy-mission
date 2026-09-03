// @vitest-environment node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../../../supabase/migrations/0004_room_lifecycle.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("0004 room lifecycle migration", () => {
  it("adds only the locked membership lifecycle columns", () => {
    expect(migration).toContain("add column if not exists status text");
    expect(migration).toContain(
      "add column if not exists banned_at timestamptz",
    );
    expect(migration).toContain("add column if not exists banned_by uuid");
    expect(migration).toContain("status in ('active', 'banned')");
    expect(migration).toContain("and banned_by is not null");
    expect(migration).not.toMatch(/banned_by uuid references/i);
    expect(migration).toMatch(
      /foreign key \(user_id\) references auth\.users \(id\) on delete restrict/i,
    );
    expect(migration).not.toMatch(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?players/i,
    );
    expect(migration).not.toMatch(/expires|expiration|cron/i);
  });

  it("locks mutating RPCs and checks actor identity plus expected version", () => {
    for (const functionName of [
      "server_join_room",
      "server_update_room",
      "server_leave_room",
      "server_ban_room_member",
      "server_delete_room",
    ]) {
      const body = functionBody(functionName);
      expect(body).toContain("for update");
      expect(body).toContain("p_expected_version");
      expect(body).toMatch(/p_(?:actor|user)_id/);
      expect(body).toContain("set search_path = ''");
    }
  });

  it("uses explicit service-role-only RPC grants and denies browser DML", () => {
    expect(migration).toContain(
      "revoke all privileges on public.rooms from anon, authenticated",
    );
    expect(migration).toContain(
      "revoke all privileges on public.room_members from anon, authenticated",
    );
    expect(migration).toContain(
      "grant select on public.room_members to authenticated",
    );
    expect(migration).toContain(
      "revoke insert, update, delete on public.rooms from service_role",
    );
    expect(migration).toContain(
      "revoke insert, update, delete on public.room_members from service_role",
    );
    for (const functionName of [
      "server_create_room",
      "server_join_room",
      "server_update_room",
      "server_leave_room",
      "server_ban_room_member",
      "server_delete_room",
    ]) {
      expect(migration).toMatch(
        new RegExp(`revoke execute on function public\\.${functionName}`),
      );
      expect(migration).toMatch(
        new RegExp(`grant execute on function public\\.${functionName}`),
      );
    }
    expect(migration).toMatch(
      /drop function if exists public\.server_rotate_room_invite/,
    );
    expect(migration).not.toMatch(
      /create (?:or replace )?function public\.server_rotate_room_invite/,
    );
  });

  it("enforces stable invites, the player limit, and no-op persistence", () => {
    expect(functionBody("server_create_room")).toContain(
      "if p_invite_hash is null",
    );
    expect(functionBody("server_join_room")).toContain("message = 'room_full'");
    expect(functionBody("server_join_room")).toMatch(/count\(\*\)[\s\S]*>= 12/);
    expect(functionBody("server_update_room")).toContain("return current_room");
  });

  it("authorizes Realtime only for active members", () => {
    const policy = migration.slice(
      migration.indexOf(
        'create policy "active room members receive room changes"',
      ),
      migration.indexOf("create schema if not exists private"),
    );
    expect(policy).toContain("status = 'active'");
    expect(policy).toContain("realtime.messages.extension = 'broadcast'");
    expect(policy).not.toContain("rooms.state");
  });
});

function functionBody(name: string): string {
  const start = migration.indexOf(`function public.${name}(`);
  if (start < 0) {
    throw new Error(`Missing ${name}`);
  }
  const end = migration.indexOf("$$;", start);
  if (end < 0) {
    throw new Error(`Unterminated ${name}`);
  }
  return migration.slice(start, end + 3).toLowerCase();
}
