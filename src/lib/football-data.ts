/**
 * Typed client for the football-data.org REST API v4.
 * All functions are pure — no Supabase, no side effects.
 * Pass a custom `fetchFn` for testing with mocked responses.
 */

const BASE_URL = "https://api.football-data.org/v4";

// ─── Error type ───────────────────────────────────────────────────────────────

export class FootballDataError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "FootballDataError";
  }
}

// ─── API response types ───────────────────────────────────────────────────────

export interface FdTeam {
  id: number;
  name: string;
  shortName: string;
}

export interface FdMatch {
  id: number;
  stage: string;
  status: string;       // 'SCHEDULED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'CANCELLED'
  matchday: number;
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    fullTime: { home: number | null; away: number | null };
  };
}

export interface FdMatchesResponse {
  count: number;
  matches: FdMatch[];
}

export interface FdStandingEntry {
  position: number;
  team: FdTeam;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface FdStandingGroup {
  stage: string;
  type: string;
  group: string | null;
  table: FdStandingEntry[];
}

export interface FdStandingsResponse {
  season: { id: number; startDate: string; endDate: string };
  standings: FdStandingGroup[];
}

// ─── Internal helper ──────────────────────────────────────────────────────────

type FetchFn = typeof fetch;

async function apiGet<T>(
  path: string,
  apiKey: string,
  fetchFn: FetchFn = fetch
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const response = await fetchFn(url, {
    headers: {
      "X-Auth-Token": apiKey,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new FootballDataError(
      `football-data.org error ${response.status}: ${body.slice(0, 200)}`,
      response.status
    );
  }

  return response.json() as Promise<T>;
}

// ─── Public functions ─────────────────────────────────────────────────────────

/**
 * Fetch current standings for a competition.
 * Used to determine which teams have qualified from the group stage.
 *
 * @param competitionId - football-data.org competition ID (e.g. 2000 for World Cup)
 * @param apiKey        - FOOTBALL_DATA_API_KEY env value
 * @param fetchFn       - injectable fetch (default: global fetch)
 */
export async function fetchStandings(
  competitionId: number,
  apiKey: string,
  fetchFn?: FetchFn
): Promise<FdStandingGroup[]> {
  const data = await apiGet<FdStandingsResponse>(
    `/competitions/${competitionId}/standings`,
    apiKey,
    fetchFn
  );
  return data.standings;
}

/**
 * Fetch FINISHED group stage matches for a competition.
 * Used for storing match records idempotently (deduped by external_match_id).
 *
 * @param competitionId - football-data.org competition ID
 * @param apiKey        - FOOTBALL_DATA_API_KEY env value
 * @param fetchFn       - injectable fetch (default: global fetch)
 */
export async function fetchFinishedGroupMatches(
  competitionId: number,
  apiKey: string,
  fetchFn?: FetchFn
): Promise<FdMatch[]> {
  const data = await apiGet<FdMatchesResponse>(
    `/competitions/${competitionId}/matches?status=FINISHED&stage=GROUP_STAGE`,
    apiKey,
    fetchFn
  );
  return data.matches;
}

/**
 * Fetch FINISHED knockout matches (R16 through Final) for a competition.
 * Used to advance teams in the bracket and record results idempotently.
 */
export async function fetchKnockoutMatches(
  competitionId: number,
  apiKey: string,
  fetchFn?: FetchFn
): Promise<FdMatch[]> {
  const stages = "ROUND_OF_16,QUARTER_FINALS,SEMI_FINALS,FINAL";
  const data = await apiGet<FdMatchesResponse>(
    `/competitions/${competitionId}/matches?status=FINISHED&stage=${stages}`,
    apiKey,
    fetchFn
  );
  return data.matches;
}

/**
 * Fetch all R16 fixtures (including SCHEDULED) to determine planned bracket positions.
 * The fixture order tells us which team occupies which bracket slot.
 */
export async function fetchR16Fixtures(
  competitionId: number,
  apiKey: string,
  fetchFn?: FetchFn
): Promise<FdMatch[]> {
  const data = await apiGet<FdMatchesResponse>(
    `/competitions/${competitionId}/matches?stage=ROUND_OF_16`,
    apiKey,
    fetchFn
  );
  return data.matches;
}

/** Maps football-data.org stage string to WinCup's MatchStage type */
export function fdStageToMatchStage(
  fdStage: string
): "r16" | "qf" | "sf" | "final" | null {
  const map: Record<string, "r16" | "qf" | "sf" | "final"> = {
    ROUND_OF_16: "r16",
    QUARTER_FINALS: "qf",
    SEMI_FINALS: "sf",
    FINAL: "final",
  };
  return map[fdStage] ?? null;
}
