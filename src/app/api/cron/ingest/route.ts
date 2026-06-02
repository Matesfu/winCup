import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { fetchStandings, fetchKnockoutMatches } from "@/lib/football-data";
import { ingestGroupStageStandings, ingestKnockoutMatches, buildExtIdMap } from "@/lib/ingest";
import { resolveRoomIfComplete } from "@/lib/resolution";
import type { RoomPublic, Country, RoomCountry, RoomTeam } from "@/lib/types/database";

/**
 * GET /api/cron/ingest
 *
 * Vercel Cron endpoint — runs every 15 minutes (vercel.json schedule).
 * Validates CRON_SECRET, then processes all active linked rooms:
 *   - group_stage rooms: fetch standings + update qualification decisions
 *   - knockout rooms: fetch finished knockout matches + advance teams
 *
 * Rate limit: 6 seconds between football-data.org API calls (≤10 req/min free tier).
 */
export async function GET(request: NextRequest) {
  // ── 1. Validate CRON_SECRET ──────────────────────────────────────────────────
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[cron/ingest] CRON_SECRET env var is not set");
    return new Response("Server misconfiguration", { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    console.warn("[cron/ingest] FOOTBALL_DATA_API_KEY not set — skipping");
    return Response.json({ ok: true, processed: 0, skipped: "no API key" });
  }

  const admin = createAdminClient();
  const results: { roomId: string; status: string; result?: object; error?: string }[] = [];

  // ── 2. Find all active linked rooms ─────────────────────────────────────────
  const { data: rooms } = await (admin as any)
    .from("rooms")
    .select("id, status, external_competition_id, external_season_id")
    .in("status", ["group_stage", "knockout"])
    .not("external_competition_id", "is", null) as {
      data: Pick<RoomPublic, "id" | "status" | "external_competition_id" | "external_season_id">[] | null;
    };

  if (!rooms || rooms.length === 0) {
    return Response.json({ ok: true, processed: 0, message: "No active linked rooms" });
  }

  // ── 3. Load country mappings once (shared across all rooms) ──────────────────
  const { data: allCountries } = await (admin as any)
    .from("countries")
    .select("code, external_team_id") as { data: Pick<Country, "code" | "external_team_id">[] | null };

  const extIdMap = buildExtIdMap(allCountries ?? []);

  // ── 4. Process each room with rate limiting ───────────────────────────────────
  for (let i = 0; i < rooms.length; i++) {
    if (i > 0) await sleep(6000); // ≤10 req/min free tier

    const room = rooms[i];
    try {
      if (room.status === "group_stage") {
        // Group Stage: standings → qualification decisions
        const standings = await fetchStandings(room.external_competition_id!, apiKey);

        const { data: rcRows } = await (admin as any)
          .from("room_countries")
          .select("country_code, qualified")
          .eq("room_id", room.id) as { data: Pick<RoomCountry, "country_code" | "qualified">[] | null };

        const roomCountryCodes = new Set((rcRows ?? []).map((r) => r.country_code));
        const existingQuals = new Map((rcRows ?? []).map((r) => [r.country_code, r.qualified]));

        const result = await ingestGroupStageStandings(
          room.id, standings, roomCountryCodes, extIdMap, existingQuals, admin as any
        );
        console.log(`[cron/ingest] group_stage room ${room.id}: ${JSON.stringify(result)}`);
        results.push({ roomId: room.id, status: "group_stage", result });

      } else if (room.status === "knockout") {
        // Knockout: finished matches → advance teams in bracket
        const finishedMatches = await fetchKnockoutMatches(room.external_competition_id!, apiKey);

        const { data: roomTeams } = await (admin as any)
          .from("room_teams")
          .select("id,country_code,bracket_position,current_stage,is_eliminated,player_id,room_id")
          .eq("room_id", room.id) as { data: RoomTeam[] | null };

        const result = await ingestKnockoutMatches(
          room.id, finishedMatches, extIdMap, roomTeams ?? [], admin as any
        );
        console.log(`[cron/ingest] knockout room ${room.id}: ${JSON.stringify(result)}`);

        // If teams advanced, a champion may have been set — attempt auto-resolution
        if (result.teamsAdvanced > 0) {
          const resolution = await resolveRoomIfComplete(room.id, admin as any);
          if (resolution) {
            console.log(`[cron/ingest] room ${room.id} resolved: ${resolution.message}`);
          }
        }

        results.push({ roomId: room.id, status: "knockout", result });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[cron/ingest] room ${room.id} failed: ${message}`);
      results.push({ roomId: room.id, status: room.status, error: message });
    }
  }

  return Response.json({ ok: true, processed: rooms.length, results });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const dynamic = "force-dynamic";
