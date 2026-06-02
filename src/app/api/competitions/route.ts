import { type NextRequest } from "next/server";

/**
 * GET /api/competitions?q=<query>
 *
 * Phase 4 will implement the real football-data.org competition search.
 * For now: returns empty results (graceful degradation when API key is absent).
 */
export async function GET(_request: NextRequest) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!apiKey) {
    return Response.json({
      competitions: [],
      message: "Competition search requires FOOTBALL_DATA_API_KEY. Add it to .env.local.",
    });
  }

  // Phase 4: implement real fetch from https://api.football-data.org/v4/competitions
  return Response.json({ competitions: [] });
}

export const dynamic = "force-dynamic";
