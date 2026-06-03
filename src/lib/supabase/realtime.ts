import { createClient } from "@/lib/supabase/client";
import type { Player, RoomPublic, RoomCountry, RoomTeam, Match, Country } from "@/lib/types/database";

// ─── subscribeLobby ───────────────────────────────────────────────────────────

export interface LobbyRealtimeCallbacks {
  onPlayerJoined: (player: Player) => void;
  onPlayerRemoved: (playerId: string) => void;
  onRoomUpdated: (room: Partial<RoomPublic>) => void;
  onRoomDeleted?: () => void;
}

/**
 * Subscribes to Realtime lobby events for a given room.
 * Returns an unsubscribe function — call it in the useEffect cleanup.
 *
 * Listens for:
 *   - players INSERT  → new player joined the lobby
 *   - rooms UPDATE    → status changed (e.g. 'lobby' → 'drawn')
 *   - rooms DELETE    → host deleted the waiting room
 *
 * Prerequisites: players and rooms must be in supabase_realtime
 * (see migration 20240103000000_realtime.sql).
 */
export function subscribeLobby(
  roomId: string,
  callbacks: LobbyRealtimeCallbacks
): () => void {
  const supabase = createClient();
  const channel = supabase
    .channel(`lobby:${roomId}`)
    .on(
      "postgres_changes" as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      { event: "INSERT", schema: "public", table: "players", filter: `room_id=eq.${roomId}` },
      (payload: { new: Record<string, unknown> }) =>
        callbacks.onPlayerJoined(payload.new as unknown as Player)
    )
    .on(
      "postgres_changes" as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      { event: "DELETE", schema: "public", table: "players", filter: `room_id=eq.${roomId}` },
      (payload: { old: Record<string, unknown> }) =>
        callbacks.onPlayerRemoved((payload.old as { id: string }).id)
    )
    .on(
      "postgres_changes" as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
      (payload: { new: Record<string, unknown> }) =>
        callbacks.onRoomUpdated(payload.new as unknown as Partial<RoomPublic>)
    )
    .on(
      "postgres_changes" as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      { event: "DELETE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
      () => callbacks.onRoomDeleted?.()
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ─── subscribeRoomUpdates ─────────────────────────────────────────────────────

/**
 * Lightweight subscription to rooms UPDATE events only.
 * Used by the draw page to detect status transitions.
 */
export function subscribeRoomUpdates(
  roomId: string,
  onUpdate: (room: Partial<RoomPublic>) => void
): () => void {
  const supabase = createClient();
  const channel = supabase
    .channel(`room-status:${roomId}`)
    .on(
      "postgres_changes" as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
      (payload: { new: Record<string, unknown> }) =>
        onUpdate(payload.new as unknown as Partial<RoomPublic>)
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ─── subscribeGroupStage ──────────────────────────────────────────────────────

export interface GroupStageCallbacks {
  onCountryUpdated: (rc: Partial<RoomCountry>) => void;
  onCountryStatusUpdated?: (country: Partial<Country>) => void;
  onPlayerUpdated: (player: Partial<Player>) => void;
  onRoomUpdated: (room: Partial<RoomPublic>) => void;
}

/**
 * Subscribe to all Realtime events needed by the Group Stage page.
 * Uses a single channel for efficiency.
 *
 * Prerequisites: room_countries must be in supabase_realtime
 * (see migration 20240104000000_realtime_phase4.sql).
 */
export function subscribeGroupStage(
  roomId: string,
  callbacks: GroupStageCallbacks
): () => void {
  const supabase = createClient();
  const channel = supabase
    .channel(`group-stage:${roomId}`)
    .on(
      "postgres_changes" as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      { event: "UPDATE", schema: "public", table: "room_countries", filter: `room_id=eq.${roomId}` },
      (payload: { new: Record<string, unknown> }) =>
        callbacks.onCountryUpdated(payload.new as unknown as Partial<RoomCountry>)
    )
    .on(
      "postgres_changes" as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      { event: "UPDATE", schema: "public", table: "countries" },
      (payload: { new: Record<string, unknown> }) =>
        callbacks.onCountryStatusUpdated?.(payload.new as unknown as Partial<Country>)
    )
    .on(
      "postgres_changes" as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      { event: "UPDATE", schema: "public", table: "players", filter: `room_id=eq.${roomId}` },
      (payload: { new: Record<string, unknown> }) =>
        callbacks.onPlayerUpdated(payload.new as unknown as Partial<Player>)
    )
    .on(
      "postgres_changes" as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
      (payload: { new: Record<string, unknown> }) =>
        callbacks.onRoomUpdated(payload.new as unknown as Partial<RoomPublic>)
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ─── subscribeLadder ──────────────────────────────────────────────────────────

export interface LadderCallbacks {
  onTeamUpdated: (team: Partial<RoomTeam>) => void;
  onMatchUpserted: (match: Partial<Match>) => void;
  onRoomStatusUpdated: (room: Partial<RoomPublic>) => void;
}

/**
 * Subscribe to all Realtime events needed by the Ladder page.
 * Returns an unsubscribe function.
 *
 * Prerequisites: room_teams and matches must be in supabase_realtime
 * (see migration 20240105000000_realtime_phase5.sql).
 */
export function subscribeLadder(
  roomId: string,
  callbacks: LadderCallbacks
): () => void {
  const supabase = createClient();
  const channel = supabase
    .channel(`ladder:${roomId}`)
    .on(
      "postgres_changes" as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      { event: "UPDATE", schema: "public", table: "room_teams", filter: `room_id=eq.${roomId}` },
      (payload: { new: Record<string, unknown> }) =>
        callbacks.onTeamUpdated(payload.new as unknown as Partial<RoomTeam>)
    )
    .on(
      "postgres_changes" as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      { event: "*", schema: "public", table: "matches", filter: `room_id=eq.${roomId}` },
      (payload: { new: Record<string, unknown> }) =>
        callbacks.onMatchUpserted(payload.new as unknown as Partial<Match>)
    )
    .on(
      "postgres_changes" as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
      (payload: { new: Record<string, unknown> }) =>
        callbacks.onRoomStatusUpdated(payload.new as unknown as Partial<RoomPublic>)
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
