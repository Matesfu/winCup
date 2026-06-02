/**
 * Winner resolution logic — pure and DB-aware helpers.
 *
 * resolveWinner     — pure function, no side effects, fully unit-testable.
 * resolveRoomIfComplete — writes to Supabase; called from cron + advanceMatch.
 */

import type { RoomPublic, RoomTeam } from "@/lib/types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WinnerResult {
  /** null = no winner (strict mode with filler champion, or last_standing with no survivors) */
  winnerPlayerId: string | null;
  message: string;
}

// ─── resolveWinner ────────────────────────────────────────────────────────────

/**
 * Determines the winner of a completed WinCup tournament.
 * Returns null if the tournament is still ongoing.
 *
 * strict:
 *   - Find the team with current_stage === 'champion'.
 *   - If that team is player-owned (player_id !== null) → winner.
 *   - If filler team → no winner ("stakes returned").
 *   - If no champion yet → null (still in progress).
 *
 * last_standing:
 *   - Count alive player teams (not eliminated, has player_id).
 *   - If exactly 1 → that player wins.
 *   - Otherwise → null (still ongoing or no survivors).
 */
export function resolveWinner(
  winRule: "strict" | "last_standing",
  roomTeams: Pick<RoomTeam, "player_id" | "current_stage" | "is_eliminated">[]
): WinnerResult | null {
  if (winRule === "strict") {
    const champ = roomTeams.find((t) => t.current_stage === "champion");
    if (!champ) return null; // no champion yet — Final not played

    return champ.player_id
      ? {
          winnerPlayerId: champ.player_id,
          message: "Champion's owner wins the pot! 🏆",
        }
      : {
          winnerPlayerId: null,
          message: "The Cup winner wasn't in this room — stakes returned 🤷",
        };
  }

  // last_standing
  const alivePlayerTeams = roomTeams.filter(
    (t) => !t.is_eliminated && t.player_id !== null
  );

  if (alivePlayerTeams.length === 1) {
    return {
      winnerPlayerId: alivePlayerTeams[0].player_id!,
      message: "Last team standing wins! 🏆",
    };
  }

  return null; // multiple alive or none — still ongoing
}

// ─── resolveRoomIfComplete ────────────────────────────────────────────────────

/**
 * Checks whether a room is ready to resolve and, if so, persists the outcome.
 *
 * Idempotent: if rooms.status is already 'finished', returns null immediately.
 * The rooms UPDATE event fires Realtime → all connected clients redirect to /winner.
 *
 * @param roomId - the room to check and potentially resolve
 * @param admin  - Supabase admin client (bypasses RLS)
 * @returns the WinnerResult that was applied, or null if still ongoing / already finished
 */
export async function resolveRoomIfComplete(
  roomId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any
): Promise<WinnerResult | null> {
  // 1. Fetch current room state
  const { data: room } = await admin
    .from("rooms")
    .select("id, win_rule, status")
    .eq("id", roomId)
    .maybeSingle() as { data: Pick<RoomPublic, "id" | "win_rule" | "status"> | null };

  if (!room) return null;
  if (room.status === "finished") return null; // already resolved — idempotent

  // 2. Fetch all room_teams for resolution check
  const { data: roomTeams } = await admin
    .from("room_teams")
    .select("player_id, current_stage, is_eliminated")
    .eq("room_id", roomId) as {
      data: Pick<RoomTeam, "player_id" | "current_stage" | "is_eliminated">[] | null;
    };

  if (!roomTeams || roomTeams.length === 0) return null;

  // 3. Attempt resolution
  const result = resolveWinner(room.win_rule, roomTeams);
  if (!result) return null; // still in progress

  // 4. Persist the outcome
  await admin
    .from("rooms")
    .update({
      winner_player_id: result.winnerPlayerId,
      status: "finished",
    })
    .eq("id", roomId);

  // Realtime UPDATE fires here → LadderRealtime.onRoomStatusUpdated → redirect to /winner

  return result;
}
