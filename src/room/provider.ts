import { hasSupabaseEnv } from "../config/env";
import { localRoomProvider } from "./localRoomProvider";
import { SupabaseRoomProvider } from "./supabaseRoomProvider";
import type { RoomProvider } from "./types";

let provider: RoomProvider | null = null;

export function getRoomProvider(): RoomProvider {
  if (!provider) {
    provider = hasSupabaseEnv()
      ? new SupabaseRoomProvider()
      : localRoomProvider;
  }
  return provider;
}

export function resetRoomProviderForTests(): void {
  provider = null;
}
