// @vitest-environment node

import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import type { RoomCommand, RoomSnapshot } from "../../room/types";
import { handleRoomsRequest, resetAdminClientForTests } from "./service";

const enabled = process.env.RUN_SUPABASE_INTEGRATION === "1";
const supabaseUrl = process.env.SUPABASE_URL ?? "";
const publishableKey = process.env.VITE_SUPABASE_ANON_KEY ?? "";

describe.skipIf(!enabled)("secure multiplayer integration", () => {
  afterAll(() => {
    resetAdminClientForTests();
  });

  it("supports four devices while preserving role-specific card secrecy", async () => {
    const [host, redOperative, blueSpymaster, blueOperative] =
      await Promise.all([
        anonymousToken(),
        anonymousToken(),
        anonymousToken(),
        anonymousToken(),
      ]);

    const created = await successful(host, {
      op: "create",
      name: "Host",
      lang: "ar",
    });
    const roomId = created.id;

    await command(host, roomId, {
      type: "assignSelf",
      team: "red",
      role: "spymaster",
    });
    await Promise.all([
      successful(redOperative, {
        op: "join",
        code: created.code,
        name: "Red operative",
      }),
      successful(blueSpymaster, {
        op: "join",
        code: created.code,
        name: "Blue spymaster",
      }),
      successful(blueOperative, {
        op: "join",
        code: created.code,
        name: "Blue operative",
      }),
    ]);
    await command(redOperative, roomId, {
      type: "assignSelf",
      team: "red",
      role: "operative",
    });
    await command(blueSpymaster, roomId, {
      type: "assignSelf",
      team: "blue",
      role: "spymaster",
    });
    await command(blueOperative, roomId, {
      type: "assignSelf",
      team: "blue",
      role: "operative",
    });

    await command(host, roomId, { type: "startGame" });
    const operativeView = await successful(redOperative, {
      op: "get",
      roomId,
    });
    const spymasterView = await successful(blueSpymaster, {
      op: "get",
      roomId,
    });

    expect(operativeView.view.board).toHaveLength(25);
    expect(operativeView.view.board.every((card) => card.kind === null)).toBe(
      true,
    );
    expect(spymasterView.view.board.every((card) => card.kind !== null)).toBe(
      true,
    );
    expect(JSON.stringify(operativeView)).not.toContain('"kind":"assassin"');

    const realtime = createClient(supabaseUrl, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    realtime.realtime.setAuth(redOperative);
    const channel = realtime.channel(`room:${roomId}`, {
      config: { private: true },
    });
    let resolveChanged: (() => void) | undefined;
    const changed = new Promise<void>((resolve) => {
      resolveChanged = resolve;
    });
    const subscribed = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("REALTIME_SUBSCRIBE_TIMEOUT")),
        8_000,
      );
      channel
        .on("broadcast", { event: "room_changed" }, () => {
          resolveChanged?.();
        })
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
    await subscribed;
    await command(host, roomId, {
      type: "renamePlayer",
      name: "Renamed host",
    });
    await withTimeout(changed, "REALTIME_CHANGE_TIMEOUT");
    await realtime.removeChannel(channel);

    await successfulDelete(host, roomId);
  }, 15_000);

  it("requires the unguessable invitation token for private rooms", async () => {
    const host = await anonymousToken();
    const guest = await anonymousToken();
    const created = await successful(host, {
      op: "create",
      name: "Private host",
      lang: "en",
      visibility: "private",
    });

    const denied = await call(guest, {
      op: "join",
      code: created.code,
      name: "Guest",
    });
    expect(denied.response.status).toBe(403);
    expect(denied.payload.error).toBe("ROOM_INVITE_INVALID");

    const joined = await successful(guest, {
      op: "join",
      code: created.code,
      name: "Guest",
      inviteToken: created.inviteToken,
    });
    expect(joined.view.me).not.toBeNull();

    await successfulDelete(host, created.id);
  });
});

async function command(
  token: string,
  roomId: string,
  commandValue: RoomCommand,
): Promise<RoomSnapshot> {
  const current = await successful(token, { op: "get", roomId });
  return successful(token, {
    op: "command",
    roomId,
    expectedVersion: current.version,
    command: commandValue,
  });
}

async function anonymousToken(): Promise<string> {
  const client = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.session) {
    throw error ?? new Error("ANONYMOUS_SESSION_MISSING");
  }
  return data.session.access_token;
}

async function successful(
  token: string,
  body: Record<string, unknown>,
): Promise<RoomSnapshot> {
  const result = await call(token, body);
  expect(result.response.status).toBe(200);
  if (!result.payload.data || "deleted" in result.payload.data) {
    throw new Error(result.payload.error ?? "ROOM_RESPONSE_MISSING");
  }
  return result.payload.data;
}

async function successfulDelete(token: string, roomId: string): Promise<void> {
  const result = await call(token, { op: "delete", roomId });
  expect(result.response.status).toBe(200);
  expect(result.payload.data).toEqual({ deleted: true });
}

async function call(token: string, body: Record<string, unknown>) {
  const response = await handleRoomsRequest(
    new Request("https://game.example/api/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );
  const payload = (await response.json()) as {
    data?: RoomSnapshot | { deleted: true };
    error?: string;
  };
  return { response, payload };
}

async function withTimeout(
  promise: Promise<void>,
  code: string,
): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
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
