import { getSupabaseClient } from "../lib/supabase/client";
import type {
  CreateSharedRoomInput,
  JoinSharedRoomInput,
  ResumeRoomResult,
  RoomCommand,
  RoomMutationResult,
  RoomProvider,
  RoomSnapshot,
  Unsubscribe,
} from "./types";

const ROOMS_API = "/api/rooms";
const INVITE_KEY_PREFIX = "codenames.roomInvite.v2.";
const LEGACY_INVITE_KEY_PREFIX = "codenames.roomInvite.";
export const ROOM_POLL_INTERVAL_MS = 5_000;

export class SupabaseRoomProvider implements RoomProvider {
  private readonly roomCodes = new Map<string, string>();

  constructor() {
    removeLegacyInviteEntries();
  }

  async create(input: CreateSharedRoomInput): Promise<RoomSnapshot> {
    return this.rememberInvite(await this.call({ op: "create", ...input }));
  }

  async resume(code: string): Promise<ResumeRoomResult> {
    try {
      const result = await this.call<ResumeRoomResult>({ op: "resume", code });
      if (result.status === "active") {
        return { ...result, room: this.withCachedInvite(result.room) };
      }
      removeInviteForCode(code);
      return result;
    } catch (error) {
      removeInviteForCode(code);
      throw error;
    }
  }

  async join(input: JoinSharedRoomInput): Promise<RoomSnapshot> {
    const room = await this.call<RoomSnapshot>({ op: "join", ...input });
    if (room.visibility === "private" && input.inviteToken) {
      writeLocal(inviteKey(room.code), input.inviteToken);
    }
    return this.rememberInvite(room);
  }

  async load(roomId: string): Promise<RoomSnapshot | null> {
    const room = await this.call<RoomSnapshot | null>({ op: "get", roomId });
    return room ? this.withCachedInvite(room) : null;
  }

  async mutate(
    roomId: string,
    expectedVersion: number,
    command: RoomCommand,
  ): Promise<RoomMutationResult> {
    const result = await this.call<RoomMutationResult>({
      op: "command",
      roomId,
      expectedVersion,
      command,
    });
    if (isRoomSnapshot(result)) {
      return this.rememberInvite(result);
    }
    this.clearRoomStorage(roomId);
    return result;
  }

  getInviteToken(roomId: string): string | null {
    const code = this.roomCodes.get(roomId);
    return code ? (readLocal(inviteKey(code)) ?? null) : null;
  }

  clearRoomStorage(roomId: string): void {
    const code = this.roomCodes.get(roomId);
    if (code) {
      removeInviteForCode(code);
      this.roomCodes.delete(roomId);
    }
  }

  subscribe(
    roomId: string,
    onChange: (room: RoomSnapshot | null) => void,
  ): Unsubscribe {
    let stopped = false;
    let loading = false;
    const supabase = getSupabaseClient();
    const channel = supabase.channel(`room:${roomId}`, {
      config: { private: true },
    });

    const refresh = async () => {
      if (stopped || loading) {
        return;
      }
      loading = true;
      try {
        const room = await this.load(roomId);
        if (!stopped) {
          if (!room) {
            this.clearRoomStorage(roomId);
          }
          onChange(room);
        }
      } catch (error) {
        if (!stopped && isPermanentAccessError(error)) {
          this.clearRoomStorage(roomId);
          onChange(null);
        }
        // A transient network failure should not eject a player from the room.
      } finally {
        loading = false;
      }
    };

    void this.getAccessToken()
      .then((token) => {
        if (stopped) {
          return;
        }
        supabase.realtime.setAuth(token);
        channel
          .on("broadcast", { event: "room_changed" }, (message) => {
            const payload = message.payload as { deleted?: unknown } | null;
            if (payload?.deleted === true) {
              this.clearRoomStorage(roomId);
              onChange(null);
              return;
            }
            void refresh();
          })
          .subscribe();
      })
      .catch(() => undefined);

    const pollTimer = setInterval(() => {
      void refresh();
    }, ROOM_POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      clearInterval(pollTimer);
      void supabase.removeChannel(channel);
    };
  }

  private async call<T = unknown>(body: Record<string, unknown>): Promise<T> {
    let token = await this.getAccessToken();
    let response = await requestRoomsApi(token, body);
    if (response.status === 401) {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        throw new Error("ROOM_SESSION_EXPIRED");
      }
      token = data.session.access_token;
      response = await requestRoomsApi(token, body);
    }

    const payload = (await response.json().catch(() => null)) as {
      data?: T;
      error?: string;
    } | null;
    if (!response.ok) {
      throw new Error(payload?.error ?? "ROOM_API_ERROR");
    }
    if (!payload || !("data" in payload)) {
      throw new Error("ROOM_API_ERROR");
    }
    return payload?.data as T;
  }

  private async getAccessToken(): Promise<string> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }
    if (data.session) {
      return data.session.access_token;
    }
    const anonymous = await supabase.auth.signInAnonymously();
    if (anonymous.error || !anonymous.data.session) {
      throw new Error("ANONYMOUS_AUTH_DISABLED");
    }
    return anonymous.data.session.access_token;
  }

  private rememberInvite(room: RoomSnapshot): RoomSnapshot {
    this.roomCodes.set(room.id, room.code);
    if (room.inviteToken) {
      writeLocal(inviteKey(room.code), room.inviteToken);
    }
    return this.withCachedInvite(room);
  }

  private withCachedInvite(room: RoomSnapshot): RoomSnapshot {
    this.roomCodes.set(room.id, room.code);
    const inviteToken = readLocal(inviteKey(room.code)) ?? null;
    return inviteToken ? { ...room, inviteToken } : room;
  }
}

function isRoomSnapshot(value: RoomMutationResult): value is RoomSnapshot {
  return "id" in value;
}

async function requestRoomsApi(
  accessToken: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return fetch(ROOMS_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function readLocal(key: string): string | undefined {
  try {
    return globalThis.localStorage?.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeLocal(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    return;
  }
}

function removeLocal(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    return;
  }
}

function inviteKey(code: string): string {
  return `${INVITE_KEY_PREFIX}${code.trim().toUpperCase()}`;
}

function removeInviteForCode(code: string): void {
  removeLocal(inviteKey(code));
}

function removeLegacyInviteEntries(): void {
  try {
    const storage = globalThis.localStorage;
    if (!storage) {
      return;
    }
    const staleKeys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (
        key?.startsWith(LEGACY_INVITE_KEY_PREFIX) &&
        !key.startsWith(INVITE_KEY_PREFIX)
      ) {
        staleKeys.push(key);
      }
    }
    for (const key of staleKeys) {
      storage.removeItem(key);
    }
  } catch {
    return;
  }
}

function isPermanentAccessError(error: unknown): boolean {
  return (
    error instanceof Error &&
    ["ROOM_SESSION_EXPIRED", "ANONYMOUS_AUTH_DISABLED"].includes(error.message)
  );
}
