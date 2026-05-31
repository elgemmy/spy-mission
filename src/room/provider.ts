import { hasSupabaseEnv } from "../config/env";
import { inMemoryRoomProvider } from "./inMemoryRoomProvider";
import type { RoomProvider, RoomRecord, Unsubscribe } from "./types";

let provider: RoomProvider | null = null;

export function getRoomProvider(): RoomProvider {
  if (!provider) {
    provider = hasSupabaseEnv()
      ? new LazySupabaseRoomProvider()
      : import.meta.env.PROD
        ? new MissingSupabaseRoomProvider()
        : inMemoryRoomProvider;
  }
  return provider;
}

export function resetRoomProviderForTests(): void {
  provider = null;
}

class LazySupabaseRoomProvider implements RoomProvider {
  private inner: RoomProvider | null = null;
  private loading: Promise<RoomProvider> | null = null;

  async create(room: RoomRecord): Promise<void> {
    return (await this.getInner()).create(room);
  }

  async delete(roomId: string): Promise<void> {
    return (await this.getInner()).delete(roomId);
  }

  async load(roomId: string): Promise<RoomRecord | null> {
    return (await this.getInner()).load(roomId);
  }

  async loadByCode(code: string): Promise<RoomRecord | null> {
    return (await this.getInner()).loadByCode(code);
  }

  async save(room: RoomRecord, expectedVersion?: number): Promise<void> {
    return (await this.getInner()).save(room, expectedVersion);
  }

  subscribe(
    roomId: string,
    onChange: (room: RoomRecord | null) => void,
  ): Unsubscribe {
    let active = true;
    let unsubscribe: Unsubscribe | null = null;

    void this.getInner().then((inner) => {
      if (!active) {
        return;
      }
      unsubscribe = inner.subscribe(roomId, onChange);
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }

  private async getInner(): Promise<RoomProvider> {
    if (this.inner) {
      return this.inner;
    }
    this.loading ??= import("./supabaseRoomProvider").then(
      ({ SupabaseRoomProvider }) => new SupabaseRoomProvider(),
    );
    this.inner = await this.loading;
    return this.inner;
  }
}

class MissingSupabaseRoomProvider implements RoomProvider {
  async create(): Promise<void> {
    throw new Error("SUPABASE_ENV_MISSING");
  }

  async delete(): Promise<void> {
    throw new Error("SUPABASE_ENV_MISSING");
  }

  async load(): Promise<RoomRecord | null> {
    throw new Error("SUPABASE_ENV_MISSING");
  }

  async loadByCode(): Promise<RoomRecord | null> {
    throw new Error("SUPABASE_ENV_MISSING");
  }

  async save(): Promise<void> {
    throw new Error("SUPABASE_ENV_MISSING");
  }

  subscribe(): Unsubscribe {
    return () => undefined;
  }
}
