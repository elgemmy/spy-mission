import { z } from "zod";

const PLACEHOLDER = "__REPLACE_ME__";

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().min(1, "VITE_SUPABASE_URL is required"),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, "VITE_SUPABASE_ANON_KEY is required"),
});

export type Env = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

let cachedEnv: Env | null = null;

function assertNotPlaceholder(name: string, value: string): void {
  if (value === PLACEHOLDER) {
    throw new Error(
      `${name} is still set to the placeholder. Copy .env.example to .env.local and set real values.`,
    );
  }
}

export function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(import.meta.env);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new Error(`Invalid environment configuration: ${message}`);
  }

  const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = parsed.data;
  assertNotPlaceholder("VITE_SUPABASE_URL", VITE_SUPABASE_URL);
  assertNotPlaceholder("VITE_SUPABASE_ANON_KEY", VITE_SUPABASE_ANON_KEY);

  cachedEnv = {
    supabaseUrl: VITE_SUPABASE_URL,
    supabaseAnonKey: VITE_SUPABASE_ANON_KEY,
  };

  return cachedEnv;
}

export function resetEnvCacheForTests(): void {
  cachedEnv = null;
}
