import { getSupabaseClient } from "../lib/supabase/client";
import type {
  CreateSharedRoomInput,
  CreateClassicRoomInput,
  CreatePartnerRoomInput,
  ClaimPartnerSeatInput,
  JoinSharedRoomInput,
  ResumeRoomResult,
  RoomCommand,
  RoomSnapshot,
  RoomMutationResult,
  RoomProvider,
  SharedRoomSnapshot,
  PartnerRoomSnapshot,
  Unsubscribe,
} from "./types";

const ROOMS_API = "/api/rooms";
const INVITE_KEY_PREFIX = "codenames.roomInvite.v2.";
const LEGACY_INVITE_KEY_PREFIX = "codenames.roomInvite.";
export const ROOM_POLL_INTERVAL_MS = 5_000;
export const ROOM_POLL_TIMEOUT_MS = 4_000;
const AUTH_LOCK_NAME = "codenames-anonymous-auth";
const AUTH_LOCK_ENTRY_PREFIX = "codenames.anonymousAuthLock.v2.";
const AUTH_LOCK_RETRY_MS = 50;
const AUTH_LOCK_WAIT_TIMEOUT_MS = 30_000;

let sessionInitializationPromise: Promise<string> | null = null;

export class SupabaseRoomProvider implements RoomProvider {
  private readonly roomCodes = new Map<string, string>();
  private activeSubscription: { roomId: string } | null = null;

  constructor() {
    removeLegacyInviteEntries();
  }

  async create(input: CreatePartnerRoomInput): Promise<PartnerRoomSnapshot>;
  async create(input: CreateClassicRoomInput): Promise<RoomSnapshot>;
  async create(input: CreateSharedRoomInput): Promise<SharedRoomSnapshot> {
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
      if (shouldClearInvite(error)) {
        removeInviteForCode(code);
      }
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

  async claimPartnerSeat(
    input: ClaimPartnerSeatInput,
  ): Promise<PartnerRoomSnapshot> {
    const room = await this.call<PartnerRoomSnapshot>({
      op: "claimPartnerSeat",
      ...input,
    });
    if (room.visibility === "private" && input.inviteToken) {
      writeLocal(inviteKey(room.code), input.inviteToken);
    }
    return this.rememberInvite(room) as PartnerRoomSnapshot;
  }

  async load(roomId: string): Promise<SharedRoomSnapshot | null> {
    const room = await this.call<SharedRoomSnapshot | null>({
      op: "get",
      roomId,
    });
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
    onChange: (room: SharedRoomSnapshot | null) => void,
  ): Unsubscribe {
    let stopped = false;
    let loading = false;
    let activeController: AbortController | null = null;
    const subscription = { roomId };
    this.activeSubscription = subscription;
    const supabase = getSupabaseClient();
    const channel = supabase.channel(`room:${roomId}`, {
      config: { private: true },
    });

    const isCurrent = () =>
      !stopped &&
      this.activeSubscription === subscription &&
      subscription.roomId === roomId;

    const refresh = async () => {
      if (!isCurrent() || loading) {
        return;
      }
      loading = true;
      const controller = new AbortController();
      activeController = controller;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeout = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            controller.abort();
            reject(new DOMException("Room refresh timed out", "AbortError"));
          }, ROOM_POLL_TIMEOUT_MS);
        });
        const room = await Promise.race([
          this.loadForSubscription(roomId, controller.signal),
          timeout,
        ]);
        if (isCurrent() && (!room || room.id === roomId)) {
          onChange(room);
        }
      } catch (error) {
        if (isCurrent() && isPermanentAccessError(error)) {
          onChange(null);
        }
        // A transient network failure should not eject a player from the room.
      } finally {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
        if (activeController === controller) {
          activeController = null;
        }
        loading = false;
      }
    };

    void this.getAccessToken()
      .then((token) => {
        if (!isCurrent()) {
          return;
        }
        supabase.realtime.setAuth(token);
        channel
          .on("broadcast", { event: "room_changed" }, (message) => {
            if (!isCurrent()) {
              return;
            }
            const payload = message.payload as { deleted?: unknown } | null;
            if (payload?.deleted === true) {
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
      if (this.activeSubscription === subscription) {
        this.activeSubscription = null;
      }
      activeController?.abort();
      clearInterval(pollTimer);
      void supabase.removeChannel(channel);
    };
  }

  private async call<T = unknown>(
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<T> {
    let token = await this.getAccessToken();
    let response = await requestRoomsApi(token, body, signal);
    if (response.status === 401) {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        throw new Error("ROOM_SESSION_EXPIRED");
      }
      token = data.session.access_token;
      response = await requestRoomsApi(token, body, signal);
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

  private getAccessToken(): Promise<string> {
    if (!sessionInitializationPromise) {
      const initialization = initializeAnonymousSession();
      sessionInitializationPromise = initialization;
      void initialization
        .finally(() => {
          if (sessionInitializationPromise === initialization) {
            sessionInitializationPromise = null;
          }
        })
        .catch(() => undefined);
    }
    return sessionInitializationPromise;
  }

  private async loadForSubscription(
    roomId: string,
    signal: AbortSignal,
  ): Promise<SharedRoomSnapshot | null> {
    const room = await this.call<SharedRoomSnapshot | null>(
      { op: "get", roomId },
      signal,
    );
    return room ? this.withCachedInvite(room) : null;
  }

  private rememberInvite<T extends SharedRoomSnapshot>(room: T): T {
    this.roomCodes.set(room.id, room.code);
    if (room.inviteToken) {
      writeLocal(inviteKey(room.code), room.inviteToken);
    }
    return this.withCachedInvite(room);
  }

  private withCachedInvite<T extends SharedRoomSnapshot>(room: T): T {
    this.roomCodes.set(room.id, room.code);
    const inviteToken = readLocal(inviteKey(room.code)) ?? null;
    return (inviteToken ? { ...room, inviteToken } : room) as T;
  }
}

function isRoomSnapshot(
  value: RoomMutationResult,
): value is SharedRoomSnapshot {
  return "id" in value;
}

async function requestRoomsApi(
  accessToken: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Response> {
  return fetch(ROOMS_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
}

async function initializeAnonymousSession(): Promise<string> {
  const supabase = getSupabaseClient();
  const current = await supabase.auth.getSession();
  if (current.error) {
    throw current.error;
  }
  if (current.data.session) {
    return current.data.session.access_token;
  }

  return withCrossTabAuthLock(async () => {
    const rechecked = await supabase.auth.getSession();
    if (rechecked.error) {
      throw rechecked.error;
    }
    if (rechecked.data.session) {
      return rechecked.data.session.access_token;
    }
    const anonymous = await supabase.auth.signInAnonymously();
    if (anonymous.error || !anonymous.data.session) {
      throw new Error("ANONYMOUS_AUTH_DISABLED");
    }
    return anonymous.data.session.access_token;
  });
}

async function withCrossTabAuthLock<T>(action: () => Promise<T>): Promise<T> {
  let locks: LockManager | undefined;
  try {
    locks = globalThis.navigator?.locks;
  } catch {
    locks = undefined;
  }
  if (locks) {
    return locks.request(AUTH_LOCK_NAME, action);
  }
  return withStorageAuthLock(action);
}

async function withStorageAuthLock<T>(action: () => Promise<T>): Promise<T> {
  const storage = getAuthLockStorage();
  if (!storage) {
    // Without either Web Locks or shared storage, proceeding could create a
    // second Auth identity in another tab. Fail closed instead.
    throw new Error("ANONYMOUS_AUTH_LOCK_UNAVAILABLE");
  }
  const owner = createLockOwner();
  const key = `${AUTH_LOCK_ENTRY_PREFIX}${owner}`;
  const startedAt = Date.now();
  const clearOwnEntry = () => removeAuthLockEntry(storage, key, owner);

  globalThis.addEventListener?.("pagehide", clearOwnEntry);
  try {
    // Lamport's bakery lock uses a separate register per tab. Unlike a
    // read/set/read lease, concurrent contenders cannot overwrite one another
    // and both enter. The ticket intentionally has no lease: a slow Auth call
    // must never allow a second identity to be minted. Waiters fail closed if a
    // crashed tab leaves an orphaned ticket.
    writeAuthLockEntry(storage, key, { owner, choosing: true, ticket: 0 });
    const ticket =
      Math.max(
        0,
        ...readAuthLockEntries(storage).map((entry) => entry.ticket),
      ) + 1;
    writeAuthLockEntry(storage, key, { owner, choosing: false, ticket });

    while (hasEarlierAuthLockContender(storage, owner, ticket)) {
      if (Date.now() - startedAt >= AUTH_LOCK_WAIT_TIMEOUT_MS) {
        throw new Error("ANONYMOUS_AUTH_LOCK_UNAVAILABLE");
      }
      await new Promise((resolve) => setTimeout(resolve, AUTH_LOCK_RETRY_MS));
    }

    return await action();
  } finally {
    globalThis.removeEventListener?.("pagehide", clearOwnEntry);
    clearOwnEntry();
  }
}

interface AuthLockEntry {
  owner: string;
  choosing: boolean;
  ticket: number;
}

function getAuthLockStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function writeAuthLockEntry(
  storage: Storage,
  key: string,
  entry: AuthLockEntry,
): void {
  try {
    storage.setItem(key, JSON.stringify(entry));
  } catch {
    throw new Error("ANONYMOUS_AUTH_LOCK_UNAVAILABLE");
  }
}

function readAuthLockEntries(storage: Storage): AuthLockEntry[] {
  try {
    const entries: AuthLockEntry[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(AUTH_LOCK_ENTRY_PREFIX)) {
        continue;
      }
      const value = JSON.parse(
        storage.getItem(key) ?? "null",
      ) as Partial<AuthLockEntry> | null;
      if (
        value &&
        typeof value.owner === "string" &&
        typeof value.choosing === "boolean" &&
        typeof value.ticket === "number" &&
        Number.isSafeInteger(value.ticket) &&
        value.ticket >= 0
      ) {
        entries.push({
          owner: value.owner,
          choosing: value.choosing,
          ticket: value.ticket,
        });
      }
    }
    return entries;
  } catch {
    throw new Error("ANONYMOUS_AUTH_LOCK_UNAVAILABLE");
  }
}

function hasEarlierAuthLockContender(
  storage: Storage,
  owner: string,
  ticket: number,
): boolean {
  return readAuthLockEntries(storage).some(
    (entry) =>
      entry.owner !== owner &&
      (entry.choosing ||
        (entry.ticket > 0 &&
          (entry.ticket < ticket ||
            (entry.ticket === ticket && entry.owner < owner)))),
  );
}

function removeAuthLockEntry(
  storage: Storage,
  key: string,
  owner: string,
): void {
  try {
    const entry = JSON.parse(storage.getItem(key) ?? "null") as {
      owner?: unknown;
    } | null;
    if (entry?.owner === owner) {
      storage.removeItem(key);
    }
  } catch {
    return;
  }
}

function createLockOwner(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("ANONYMOUS_AUTH_LOCK_UNAVAILABLE");
  }
  const bytes = new Uint32Array(4);
  globalThis.crypto.getRandomValues(bytes);
  return `${Date.now()}-${Array.from(bytes).join("-")}`;
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
    [
      "ROOM_BANNED",
      "ROOM_NOT_FOUND",
      "ROOM_NOT_MEMBER",
      "ROOM_SESSION_EXPIRED",
      "ANONYMOUS_AUTH_DISABLED",
    ].includes(error.message)
  );
}

function shouldClearInvite(error: unknown): boolean {
  return (
    error instanceof Error &&
    ["ROOM_BANNED", "ROOM_NOT_FOUND", "ROOM_NOT_MEMBER"].includes(error.message)
  );
}

export function resetAnonymousSessionInitializationForTests(): void {
  sessionInitializationPromise = null;
  const storage = getAuthLockStorage();
  if (!storage) {
    return;
  }
  for (const key of Array.from({ length: storage.length }, (_, index) =>
    storage.key(index),
  )) {
    if (key?.startsWith(AUTH_LOCK_ENTRY_PREFIX)) {
      removeLocal(key);
    }
  }
}

export function runStorageAuthLockForTests<T>(
  action: () => Promise<T>,
): Promise<T> {
  return withStorageAuthLock(action);
}
