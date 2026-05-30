import { getSupabaseClient } from "../lib/supabase/client";
import type { RoomProvider, RoomRecord, Unsubscribe } from "./types";

/**
 * Supabase-backed room provider (kept out of the default path until backend
 * schema/RLS are installed). The room envelope maps to the planned `rooms` row.
 */
export class SupabaseRoomProvider implements RoomProvider {
  async create(room: RoomRecord): Promise<void> {
    await this.save(room);
  }

  async delete(roomId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("rooms").delete().eq("id", roomId);
    if (error) {
      throw error;
    }
  }

  async load(roomId: string): Promise<RoomRecord | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? rowToRoom(data) : null;
  }

  async loadByCode(code: string): Promise<RoomRecord | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", code.toUpperCase())
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? rowToRoom(data) : null;
  }

  async save(room: RoomRecord, expectedVersion?: number): Promise<void> {
    const supabase = getSupabaseClient();
    const row = {
      id: room.id,
      code: room.code,
      host_id: room.hostId,
      visibility: room.visibility,
      state: room.state,
      ui: room.ui,
      version: room.version,
      created_at: room.createdAt,
      updated_at: room.updatedAt,
    };

    const { error } =
      expectedVersion === undefined
        ? await supabase.from("rooms").upsert(row)
        : await supabase
            .from("rooms")
            .update(row)
            .eq("id", room.id)
            .eq("version", expectedVersion);

    if (error) {
      throw error;
    }
  }

  subscribe(
    roomId: string,
    onChange: (room: RoomRecord | null) => void,
  ): Unsubscribe {
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
          if (payload.eventType === "DELETE") {
            onChange(null);
            return;
          }
          if (payload.new) {
            onChange(rowToRoom(payload.new));
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }
}

function rowToRoom(row: Record<string, unknown>): RoomRecord {
  return {
    id: String(row.id),
    code: String(row.code),
    hostId: String(row.host_id),
    visibility: row.visibility === "private" ? "private" : "public",
    state: row.state as RoomRecord["state"],
    ui: row.ui as RoomRecord["ui"],
    version: Number(row.version ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
