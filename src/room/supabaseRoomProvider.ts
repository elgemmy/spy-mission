import { getSupabaseClient } from "../lib/supabase/client";
import type {
  CreateSharedRoomInput,
  JoinSharedRoomInput,
  RoomCommand,
  RoomProvider,
  RoomSnapshot,
  Unsubscribe,
} from "./types";

const ROOMS_API = "/api/rooms";
const INVITE_KEY_PREFIX = "codenames.roomInvite.";

export class SupabaseRoomProvider implements RoomProvider {
  async create(input: CreateSharedRoomInput): Promise<RoomSnapshot> {
    return this.rememberInvite(await this.call({ op: "create", ...input }));
  }

  async join(input: JoinSharedRoomInput): Promise<RoomSnapshot> {
    return this.call({ op: "join", ...input });
  }

  async load(roomId: string): Promise<RoomSnapshot | null> {
    const room = await this.call<RoomSnapshot | null>({ op: "get", roomId });
    return room ? this.withCachedInvite(room) : null;
  }

  async mutate(
    roomId: string,
    expectedVersion: number,
    command: RoomCommand,
  ): Promise<RoomSnapshot> {
    const room = await this.call<RoomSnapshot>({
      op: "command",
      roomId,
      expectedVersion,
      command,
    });
    return this.rememberInvite(room);
  }

  async delete(roomId: string): Promise<void> {
    await this.call({ op: "delete", roomId });
    removeLocal(`${INVITE_KEY_PREFIX}${roomId}`);
  }

  async ensureInvite(roomId: string, expectedVersion: number): Promise<string> {
    const cached = readLocal(`${INVITE_KEY_PREFIX}${roomId}`);
    if (cached) {
      return cached;
    }
    const room = await this.call<RoomSnapshot>({
      op: "invite",
      roomId,
      expectedVersion,
    });
    const remembered = this.rememberInvite(room);
    if (!remembered.inviteToken) {
      throw new Error("ROOM_INVITE_UNAVAILABLE");
    }
    return remembered.inviteToken;
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
          onChange(room);
        }
      } catch {
        // A transient fetch failure should not eject a player from the room.
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
          .on("broadcast", { event: "room_changed" }, () => {
            void refresh();
          })
          .subscribe();
      })
      .catch(() => undefined);

    const pollTimer = setInterval(() => {
      void refresh();
    }, 15_000);

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
    if (room.visibility === "public") {
      removeLocal(`${INVITE_KEY_PREFIX}${room.id}`);
      return room;
    }
    if (room.inviteToken) {
      writeLocal(`${INVITE_KEY_PREFIX}${room.id}`, room.inviteToken);
    }
    return this.withCachedInvite(room);
  }

  private withCachedInvite(room: RoomSnapshot): RoomSnapshot {
    const inviteToken = readLocal(`${INVITE_KEY_PREFIX}${room.id}`);
    return inviteToken ? { ...room, inviteToken } : room;
  }
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
