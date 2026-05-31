import type { RoomProvider, RoomRecord, Unsubscribe } from "./types";
import { normalizeRoomRecord } from "./uiState";

type Listener = (room: RoomRecord | null) => void;

const STORAGE_KEY = "codenames.localRooms.v1";

export class InMemoryRoomProvider implements RoomProvider {
  private readonly rooms = new Map<string, RoomRecord>();
  private readonly codes = new Map<string, string>();
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor() {
    this.hydrate();
  }

  async create(room: RoomRecord): Promise<void> {
    const normalized = normalizeRoomRecord(room);
    this.rooms.set(normalized.id, normalized);
    this.codes.set(normalized.code, normalized.id);
    this.persist();
    this.notify(normalized);
  }

  async delete(roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (room) {
      this.codes.delete(room.code);
    }
    this.rooms.delete(roomId);
    this.persist();
    this.notifyDelete(roomId);
    this.listeners.delete(roomId);
  }

  async load(roomId: string): Promise<RoomRecord | null> {
    return this.rooms.get(roomId) ?? null;
  }

  async loadByCode(code: string): Promise<RoomRecord | null> {
    const roomId = this.codes.get(code.toUpperCase());
    if (!roomId) {
      return null;
    }
    return this.load(roomId);
  }

  async save(room: RoomRecord, _expectedVersion?: number): Promise<void> {
    void _expectedVersion;
    const normalized = normalizeRoomRecord(room);
    this.rooms.set(normalized.id, normalized);
    this.codes.set(normalized.code, normalized.id);
    this.persist();
    this.notify(normalized);
  }

  subscribe(
    roomId: string,
    onChange: (room: RoomRecord | null) => void,
  ): Unsubscribe {
    const set = this.listeners.get(roomId) ?? new Set<Listener>();
    set.add(onChange);
    this.listeners.set(roomId, set);

    const current = this.rooms.get(roomId);
    if (current) {
      onChange(current);
    }

    return () => {
      set.delete(onChange);
      if (set.size === 0) {
        this.listeners.delete(roomId);
      }
    };
  }

  private notify(room: RoomRecord): void {
    const roomListeners = this.listeners.get(room.id);
    if (roomListeners) {
      for (const listener of roomListeners) {
        listener(room);
      }
    }
  }

  private notifyDelete(roomId: string): void {
    const roomListeners = this.listeners.get(roomId);
    if (roomListeners) {
      for (const listener of roomListeners) {
        listener(null);
      }
    }
  }

  private hydrate(): void {
    const raw = readStorage(STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const rooms = JSON.parse(raw) as RoomRecord[];
      for (const room of rooms) {
        const normalized = normalizeRoomRecord(room);
        this.rooms.set(normalized.id, normalized);
        this.codes.set(normalized.code, normalized.id);
      }
    } catch {
      writeStorage(STORAGE_KEY, "[]");
    }
  }

  private persist(): void {
    writeStorage(STORAGE_KEY, JSON.stringify(Array.from(this.rooms.values())));
  }
}

export const inMemoryRoomProvider = new InMemoryRoomProvider();

function readStorage(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    return;
  }
}
