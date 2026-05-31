import { hasSupabaseEnv } from "../config/env";
import { inMemoryRoomProvider } from "./inMemoryRoomProvider";
import { SupabaseRoomProvider } from "./supabaseRoomProvider";
import type { RoomProvider, RoomRecord, Unsubscribe } from "./types";

let provider: RoomProvider | null = null;

export function getRoomProvider(): RoomProvider {
  if (!provider) {
    provider = hasSupabaseEnv()
      ? new SupabaseRoomProvider()
      : import.meta.env.PROD
        ? new MissingSupabaseRoomProvider()
        : inMemoryRoomProvider;
  }
  return provider;
}

export function resetRoomProviderForTests(): void {
  provider = null;
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
