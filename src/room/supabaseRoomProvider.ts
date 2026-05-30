import type { GameState } from "../engine";
import { getSupabaseClient } from "../lib/supabase/client";
import type { RoomProvider, Unsubscribe } from "./types";

/**
 * Supabase-backed room provider (Phase 4).
 * Skeleton: wire to `rooms` table with jsonb state + Realtime when backend exists.
 */
export class SupabaseRoomProvider implements RoomProvider {
  async load(roomId: string): Promise<GameState | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("rooms")
      .select("state")
      .eq("id", roomId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data?.state as GameState | undefined) ?? null;
  }

  async save(roomId: string, state: GameState): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("rooms").upsert({
      id: roomId,
      state,
    });

    if (error) {
      throw error;
    }
  }

  subscribe(roomId: string, onChange: (state: GameState) => void): Unsubscribe {
    const supabase = getSupabaseClient();

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const next = (payload.new as { state?: GameState } | undefined)?.state;
          if (next) {
            onChange(next);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }
}
