// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { getEnv, resetEnvCacheForTests } from "./env";

describe("getEnv", () => {
  afterEach(() => {
    resetEnvCacheForTests();
    vi.unstubAllEnvs();
  });

  it("rejects placeholder values", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "__REPLACE_ME__");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-key");

    expect(() => getEnv()).toThrow(/placeholder/i);
  });
});
