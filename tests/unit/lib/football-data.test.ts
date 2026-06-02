import {
  fetchStandings,
  fetchFinishedGroupMatches,
  FootballDataError,
} from "@/lib/football-data";

const MOCK_API_KEY = "test-api-key";
const COMPETITION_ID = 2000;

function mockFetch(status: number, body: unknown): typeof fetch {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  }) as unknown as typeof fetch;
}

const MOCK_STANDINGS_RESPONSE = {
  season: { id: 1316, startDate: "2026-11-20", endDate: "2026-12-18" },
  standings: [
    {
      stage: "GROUP_STAGE",
      type: "TOTAL",
      group: "GROUP_A",
      table: [
        { position: 1, team: { id: 759, name: "Brazil", shortName: "Brazil" }, playedGames: 3, won: 2, draw: 1, lost: 0, points: 7, goalsFor: 6, goalsAgainst: 2 },
        { position: 2, team: { id: 762, name: "Argentina", shortName: "Argentina" }, playedGames: 3, won: 1, draw: 1, lost: 1, points: 4, goalsFor: 3, goalsAgainst: 3 },
        { position: 3, team: { id: 777, name: "Germany", shortName: "Germany" }, playedGames: 3, won: 1, draw: 0, lost: 2, points: 3, goalsFor: 3, goalsAgainst: 4 },
        { position: 4, team: { id: 773, name: "France", shortName: "France" }, playedGames: 3, won: 0, draw: 2, lost: 1, points: 2, goalsFor: 2, goalsAgainst: 5 },
      ],
    },
  ],
};

const MOCK_MATCHES_RESPONSE = {
  count: 2,
  matches: [
    {
      id: 101,
      stage: "GROUP_STAGE",
      status: "FINISHED",
      matchday: 1,
      homeTeam: { id: 759, name: "Brazil", shortName: "Brazil" },
      awayTeam: { id: 762, name: "Argentina", shortName: "Argentina" },
      score: { winner: "HOME_TEAM", fullTime: { home: 2, away: 1 } },
    },
    {
      id: 102,
      stage: "GROUP_STAGE",
      status: "SCHEDULED",
      matchday: 2,
      homeTeam: { id: 777, name: "Germany", shortName: "Germany" },
      awayTeam: { id: 773, name: "France", shortName: "France" },
      score: { winner: null, fullTime: { home: null, away: null } },
    },
  ],
};

// ── fetchStandings ────────────────────────────────────────────────────────────

describe("fetchStandings()", () => {
  it("sends the correct URL", async () => {
    const mockFetchFn = mockFetch(200, MOCK_STANDINGS_RESPONSE);
    await fetchStandings(COMPETITION_ID, MOCK_API_KEY, mockFetchFn);
    const call = (mockFetchFn as jest.Mock).mock.calls[0];
    expect(call[0]).toContain(`/competitions/${COMPETITION_ID}/standings`);
  });

  it("sends the X-Auth-Token header", async () => {
    const mockFetchFn = mockFetch(200, MOCK_STANDINGS_RESPONSE);
    await fetchStandings(COMPETITION_ID, MOCK_API_KEY, mockFetchFn);
    const call = (mockFetchFn as jest.Mock).mock.calls[0];
    expect(call[1].headers["X-Auth-Token"]).toBe(MOCK_API_KEY);
  });

  it("returns the standings array from the response", async () => {
    const result = await fetchStandings(COMPETITION_ID, MOCK_API_KEY, mockFetch(200, MOCK_STANDINGS_RESPONSE));
    expect(result).toEqual(MOCK_STANDINGS_RESPONSE.standings);
    expect(result[0].group).toBe("GROUP_A");
  });

  it("throws FootballDataError on 401", async () => {
    await expect(
      fetchStandings(COMPETITION_ID, MOCK_API_KEY, mockFetch(401, { message: "Unauthorized" }))
    ).rejects.toThrow(FootballDataError);
  });

  it("FootballDataError on 401 has statusCode 401", async () => {
    try {
      await fetchStandings(COMPETITION_ID, MOCK_API_KEY, mockFetch(401, {}));
    } catch (e) {
      expect(e).toBeInstanceOf(FootballDataError);
      expect((e as FootballDataError).statusCode).toBe(401);
    }
  });

  it("throws FootballDataError on 429 (rate limited)", async () => {
    await expect(
      fetchStandings(COMPETITION_ID, MOCK_API_KEY, mockFetch(429, { message: "Rate limit" }))
    ).rejects.toThrow(FootballDataError);
  });
});

// ── fetchFinishedGroupMatches ─────────────────────────────────────────────────

describe("fetchFinishedGroupMatches()", () => {
  it("sends the correct URL including FINISHED and GROUP_STAGE filters", async () => {
    const mockFetchFn = mockFetch(200, MOCK_MATCHES_RESPONSE);
    await fetchFinishedGroupMatches(COMPETITION_ID, MOCK_API_KEY, mockFetchFn);
    const url: string = (mockFetchFn as jest.Mock).mock.calls[0][0];
    expect(url).toContain("status=FINISHED");
    expect(url).toContain("stage=GROUP_STAGE");
  });

  it("returns the matches array", async () => {
    const result = await fetchFinishedGroupMatches(COMPETITION_ID, MOCK_API_KEY, mockFetch(200, MOCK_MATCHES_RESPONSE));
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(101);
  });
});

// ── FootballDataError ─────────────────────────────────────────────────────────

describe("FootballDataError", () => {
  it("is an instance of Error", () => {
    const err = new FootballDataError("test", 400);
    expect(err).toBeInstanceOf(Error);
  });

  it("has the correct statusCode", () => {
    const err = new FootballDataError("test", 404);
    expect(err.statusCode).toBe(404);
  });

  it("has the correct name", () => {
    expect(new FootballDataError("test", 500).name).toBe("FootballDataError");
  });
});
