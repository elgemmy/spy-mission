import type { GameState } from "../engine";
import type { RoomProvider, Unsubscribe } from "./types";

type Listener = (state: GameState) => void;

export class InMemoryRoomProvider implements RoomProvider {
  private readonly rooms = new Map<string, GameState>();
  private readonly listeners = new Map<string, Set<Listener>>();

  async load(roomId: string): Promise<GameState | null> {
    return this.rooms.get(roomId) ?? null;
  }

  async save(roomId: string, state: GameState): Promise<void> {
    this.rooms.set(roomId, state);
    const roomListeners = this.listeners.get(roomId);
    if (roomListeners) {
      for (const listener of roomListeners) {
        listener(state);
      }
    }
  }

  subscribe(roomId: string, onChange: (state: GameState) => void): Unsubscribe {
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
}

export const inMemoryRoomProvider = new InMemoryRoomProvider();
