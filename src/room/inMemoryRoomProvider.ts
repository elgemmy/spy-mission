import type { RoomStorage, SharedRoomRecord, Unsubscribe } from "./types";
import { normalizeRoomRecord } from "./uiState";

type Listener = (room: SharedRoomRecord | null) => void;

export class InMemoryRoomProvider implements RoomStorage {
  private readonly rooms = new Map<string, SharedRoomRecord>();
  private readonly codes = new Map<string, string>();
  private readonly listeners = new Map<string, Set<Listener>>();

  async create(room: SharedRoomRecord): Promise<void> {
    await this.save(room);
  }

  async delete(roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (room) {
      this.codes.delete(room.code);
    }
    this.rooms.delete(roomId);
    this.notify(roomId, null);
    this.listeners.delete(roomId);
  }

  async load(roomId: string): Promise<SharedRoomRecord | null> {
    return this.rooms.get(roomId) ?? null;
  }

  async loadByCode(code: string): Promise<SharedRoomRecord | null> {
    const roomId = this.codes.get(code.toUpperCase());
    if (!roomId) {
      return null;
    }
    return this.load(roomId);
  }

  async save(room: SharedRoomRecord, _expectedVersion?: number): Promise<void> {
    void _expectedVersion;
    const normalized = normalizeRoomRecord(room);
    this.rooms.set(normalized.id, normalized);
    this.codes.set(normalized.code, normalized.id);
    this.notify(normalized.id, normalized);
  }

  subscribe(
    roomId: string,
    onChange: (room: SharedRoomRecord | null) => void,
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

  private notify(roomId: string, room: SharedRoomRecord | null): void {
    const roomListeners = this.listeners.get(roomId);
    if (roomListeners) {
      for (const listener of roomListeners) {
        listener(room);
      }
    }
  }
}

export const inMemoryRoomProvider = new InMemoryRoomProvider();
