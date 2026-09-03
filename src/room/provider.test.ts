import { afterEach, describe, expect, it, vi } from "vitest";

import { getRoomProvider, resetRoomProviderForTests } from "./provider";
import { SupabaseRoomProvider } from "./supabaseRoomProvider";

describe("getRoomProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetRoomProviderForTests();
  });

  it("uses the server-authorized provider when Supabase is configured", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "public-anon-key");

    expect(getRoomProvider()).toBeInstanceOf(SupabaseRoomProvider);
  });
});
