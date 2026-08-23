import { inMemoryRoomProvider } from "./inMemoryRoomProvider";
import type { RoomProvider } from "./types";

let provider: RoomProvider | null = null;

export function getRoomProvider(): RoomProvider {
  if (!provider) {
    provider = inMemoryRoomProvider;
  }
  return provider;
}

export function resetRoomProviderForTests(): void {
  provider = null;
}
