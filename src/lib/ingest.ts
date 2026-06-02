/**
 * Core group stage ingest logic — pure business logic, no HTTP calls.
 * Takes pre-fetched standings data and writes qualification decisions to Supabase.
 * Idempotent: skips any country already decided (qualified !== null).
 */

import type { FdStandingGroup, FdMatch } from "@/lib/football-data";
import { fdStageToMatchStage } from "@/lib/football-data";
import { getStartingStage, getNextStageInfo, STAGE_ORDER, positionAtStage } from "@/lib/bracket";
import type { RoomPublic, Player, RoomCountry, RoomTeam, MatchStage, KnockoutStage } from "@/lib/types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Minimal Supabase admin client interface (subset used by ingest) */
export interface IngestAdminClient {
  from(table: string): {
    select(cols: string): {
      eq(col: string, val: unknown): {
        maybeSingle(): Promise<{ data: unknown; error: unknown }>;
      };
    };
    update(vals: object): {
      eq(col: string, val: unknown): Promise<{ error: unknown }>;
    };
  };
}

export interface GroupIngestResult {
  countriesUpdated: number;
  playersEliminated: number;
  skippedIncomplete: number;
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Process group stage standings for one room.
 *
 * @param roomId              - The room to update
 * @param standings           - Standings from football-data.org
 * @param roomCountryCodes    - Country codes selected for this room (from room_countries)
 * @param extIdToCountryCode  - Map: external_team_id → country code
 * @param existingQuals       - Current room_countries state (countryCode → qualified)
 * @param admin               - Supabase admin client (bypasses RLS)
 * @param qualifyCount        - Teams per group that advance (default: 2)
 */
export async function ingestGroupStageStandings(
  roomId: string,
  standings: FdStandingGroup[],
  roomCountryCodes: Set<string>,
  extIdToCountryCode: Map<number, string>,
  existingQuals: Map<string, boolean | null>,
  admin: IngestAdminClient,
  qualifyCount = 2
): Promise<GroupIngestResult> {
  let countriesUpdated = 0;
  let playersEliminated = 0;
  let skippedIncomplete = 0;

  for (const group of standings) {
    // Only process groups (skip aggregate standings)
    if (!group.group) continue;

    const table = group.table;
    if (table.length === 0) continue;

    // Check if group is complete: each team must have played (table.length - 1) games
    const expectedGames = table.length - 1;
    const groupComplete = table.every((e) => e.playedGames >= expectedGames);
    if (!groupComplete) {
      skippedIncomplete++;
      continue;
    }

    // table is sorted by position ascending (position 1 = leader)
    for (let i = 0; i < table.length; i++) {
      const entry = table[i];
      const countryCode = extIdToCountryCode.get(entry.team.id);

      // Team not mapped to any country in our system
      if (!countryCode) continue;
      // Country not selected for this room
      if (!roomCountryCodes.has(countryCode)) continue;
      // Already decided — skip (idempotency)
      if (existingQuals.get(countryCode) !== null && existingQuals.get(countryCode) !== undefined) continue;

      const qualified = i < qualifyCount; // 0-indexed: positions 0..qualifyCount-1 qualify

      // Update room_countries.qualified
      await (admin as any)
        .from("room_countries")
        .update({ qualified })
        .eq("room_id", roomId)
        .eq("country_code", countryCode);

      countriesUpdated++;

      // If knocked out, eliminate the player
      if (!qualified) {
        const { data: player } = await (admin as any)
          .from("players")
          .select("id, is_eliminated")
          .eq("room_id", roomId)
          .eq("assigned_country", countryCode)
          .maybeSingle() as { data: Pick<Player, "id" | "is_eliminated"> | null };

        if (player && !player.is_eliminated) {
          await (admin as any)
            .from("players")
            .update({ is_eliminated: true })
            .eq("id", player.id);
          playersEliminated++;
        }
      }
    }
  }

  return { countriesUpdated, playersEliminated, skippedIncomplete };
}

/** Build a Map from external_team_id → country code, for all countries in the DB */
export function buildExtIdMap(
  countries: { code: string; external_team_id: number | null }[]
): Map<number, string> {
  const map = new Map<number, string>();
  for (const c of countries) {
    if (c.external_team_id !== null) {
      map.set(c.external_team_id, c.code);
    }
  }
  return map;
}

// ─── Knockout ingest ──────────────────────────────────────────────────────────

export interface KnockoutIngestResult {
  matchesUpserted: number;
  teamsAdvanced: number;
  teamsEliminated: number;
}

/**
 * Process finished knockout matches for one room.
 * Idempotent: deduped on external_match_id; skips already-eliminated teams.
 *
 * @param roomId          - the room to update
 * @param finishedMatches - finished knockout matches from football-data.org
 * @param extIdToCode     - external_team_id → country code
 * @param roomTeams       - current room_teams state
 * @param admin           - Supabase admin client
 */
export async function ingestKnockoutMatches(
  roomId: string,
  finishedMatches: FdMatch[],
  extIdToCode: Map<number, string>,
  roomTeams: RoomTeam[],
  admin: IngestAdminClient
): Promise<KnockoutIngestResult> {
  let matchesUpserted = 0;
  let teamsAdvanced = 0;
  let teamsEliminated = 0;

  const teamByCode = new Map(roomTeams.map((t) => [t.country_code, t]));
  const startingStage = getStartingStage(roomTeams.length);

  // Fetch existing match records to check idempotency
  const { data: existingMatches } = await (admin as any)
    .from("matches")
    .select("external_match_id")
    .eq("room_id", roomId) as { data: { external_match_id: number | null }[] | null };

  const processedIds = new Set(
    (existingMatches ?? [])
      .map((m) => m.external_match_id)
      .filter((id): id is number => id !== null)
  );

  for (const match of finishedMatches) {
    // Skip non-knockout matches (shouldn't happen but guard anyway)
    const stage = fdStageToMatchStage(match.stage);
    if (!stage) continue;

    // Skip already-processed matches
    if (processedIds.has(match.id)) continue;

    // Map team IDs to country codes
    const homeCode = extIdToCode.get(match.homeTeam.id);
    const awayCode = extIdToCode.get(match.awayTeam.id);
    if (!homeCode || !awayCode) continue;

    // Determine winner
    let winnerCode: string | null = null;
    let loserCode: string | null = null;
    if (match.score.winner === "HOME_TEAM") {
      winnerCode = homeCode;
      loserCode = awayCode;
    } else if (match.score.winner === "AWAY_TEAM") {
      winnerCode = awayCode;
      loserCode = homeCode;
    } else {
      continue; // DRAW shouldn't happen in knockout; skip
    }

    const winnerTeam = teamByCode.get(winnerCode);
    const loserTeam = teamByCode.get(loserCode);

    // Determine match_order from winner's position at this stage
    let matchOrder = 1;
    if (winnerTeam) {
      const posAtThisStage = positionAtStage(
        winnerTeam.bracket_position,
        stage,
        startingStage
      );
      matchOrder = Math.ceil(posAtThisStage / 2);
    }

    // Upsert match record (idempotent)
    await (admin as any)
      .from("matches")
      .upsert(
        {
          room_id: roomId,
          external_match_id: match.id,
          stage,
          team_a_code: homeCode,
          team_b_code: awayCode,
          winner_code: winnerCode,
          match_order: matchOrder,
        },
        { onConflict: "room_id,external_match_id", ignoreDuplicates: false }
      );
    matchesUpserted++;

    // Advance winner
    if (winnerTeam && !winnerTeam.is_eliminated) {
      const posAtStageValue = positionAtStage(
        winnerTeam.bracket_position,
        stage,
        startingStage
      );
      const nextInfo = getNextStageInfo(stage, posAtStageValue);

      if (nextInfo) {
        // Only advance if not already at a later stage
        const currentIdx = STAGE_ORDER.indexOf(winnerTeam.current_stage as any);
        const nextIdx = STAGE_ORDER.indexOf(nextInfo.nextStage);
        if (nextIdx > currentIdx) {
          await (admin as any)
            .from("room_teams")
            .update({
              current_stage: nextInfo.nextStage as KnockoutStage,
            })
            .eq("room_id", roomId)
            .eq("country_code", winnerCode);

          // Update local state for subsequent iterations
          (winnerTeam as any).current_stage = nextInfo.nextStage;
          teamsAdvanced++;
        }
      } else {
        // This is the Final winner — mark as champion
        const currentIdx = STAGE_ORDER.indexOf(winnerTeam.current_stage as any);
        if (currentIdx < 4) { // not already champion
          await (admin as any)
            .from("room_teams")
            .update({ current_stage: "champion" as KnockoutStage })
            .eq("room_id", roomId)
            .eq("country_code", winnerCode);
          (winnerTeam as any).current_stage = "champion";
          teamsAdvanced++;
        }
      }
    }

    // Eliminate loser
    if (loserTeam && !loserTeam.is_eliminated) {
      await (admin as any)
        .from("room_teams")
        .update({ is_eliminated: true })
        .eq("room_id", roomId)
        .eq("country_code", loserCode);
      (loserTeam as any).is_eliminated = true;
      teamsEliminated++;

      // Eliminate loser's player
      const { data: loserPlayer } = await (admin as any)
        .from("players")
        .select("id, is_eliminated")
        .eq("room_id", roomId)
        .eq("assigned_country", loserCode)
        .maybeSingle() as { data: Pick<Player, "id" | "is_eliminated"> | null };

      if (loserPlayer && !loserPlayer.is_eliminated) {
        await (admin as any)
          .from("players")
          .update({ is_eliminated: true })
          .eq("id", loserPlayer.id);
      }
    }
  }

  return { matchesUpserted, teamsAdvanced, teamsEliminated };
}
