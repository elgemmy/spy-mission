import { afterEach, describe, expect, it, vi } from "vitest";

import { inMemoryRoomProvider } from "./inMemoryRoomProvider";
import { getRoomProvider, resetRoomProviderForTests } from "./provider";

describe("getRoomProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetRoomProviderForTests();
  });

  it("does not enable direct Supabase access from public frontend credentials", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "public-anon-key");

    expect(getRoomProvider()).toBe(inMemoryRoomProvider);
  });
});
