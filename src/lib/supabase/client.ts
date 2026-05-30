import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "../../config/env";

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    const env = getEnv();
    client = createClient(env.supabaseUrl, env.supabaseAnonKey);
  }
  return client;
}

export function resetSupabaseClientForTests(): void {
  client = null;
}
