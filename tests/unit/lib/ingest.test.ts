import { ingestGroupStageStandings, buildExtIdMap } from "@/lib/ingest";
import type { FdStandingGroup } from "@/lib/football-data";

// ── Test helpers ──────────────────────────────────────────────────────────────

const ROOM_ID = "room-test-123";

/** Build a mock admin client that records calls */
function buildMockAdmin(options: {
  existingPlayers?: { id: string; is_eliminated: boolean }[];
} = {}) {
  const updates: { table: string; id: string; vals: object }[] = [];
  const players = options.existingPlayers ?? [];

  return {
    _updates: updates,
    from(table: string) {
      return {
        select(_cols: string) {
          return {
            eq(_col: string, _val: unknown) {
              return {
                eq(_col2: string, val2: unknown) {
                  return {
                    maybeSingle() {
                      // Mock: look up player by assigned_country
                      const player = players.find(
                        (p) => p.id === val2 || p.id.includes(String(val2))
                      );
                      return Promise.resolve({ data: player ?? null, error: null });
                    },
                  };
                },
                maybeSingle() {
                  const player = players[0] ?? null;
                  return Promise.resolve({ data: player, error: null });
                },
              };
            },
          };
        },
        update(vals: object) {
          return {
            eq(_col: string, _val: unknown) {
              return {
                eq(_col2: string, val2: unknown) {
                  updates.push({ table, id: String(val2), vals });
                  return Promise.resolve({ error: null });
                },
                then: undefined, // force .eq().eq() usage
                // single eq path
                [Symbol.toPrimitive]() { return ""; },
              };
            },
          };
        },
      };
    },
  };
}

function makeStandings(
  group: string,
  teams: { id: number; name: string; playedGames: number }[],
  qualifyCount = 2
): FdStandingGroup {
  return {
    stage: "GROUP_STAGE",
    type: "TOTAL",
    group,
    table: teams.map((t, i) => ({
      position: i + 1,
      team: { id: t.id, name: t.name, shortName: t.name },
      playedGames: t.playedGames,
      won: 0, draw: 0, lost: 0, points: 0, goalsFor: 0, goalsAgainst: 0,
    })),
  };
}

// ── buildExtIdMap ─────────────────────────────────────────────────────────────

describe("buildExtIdMap()", () => {
  it("maps external_team_id to country code", () => {
    const map = buildExtIdMap([
      { code: "ARG", external_team_id: 762 },
      { code: "BRA", external_team_id: 759 },
    ]);
    expect(map.get(762)).toBe("ARG");
    expect(map.get(759)).toBe("BRA");
  });

  it("skips countries with null external_team_id", () => {
    const map = buildExtIdMap([
      { code: "ARG", external_team_id: null },
      { code: "BRA", external_team_id: 759 },
    ]);
    expect(map.size).toBe(1);
    expect(map.get(759)).toBe("BRA");
  });
});

// ── ingestGroupStageStandings ─────────────────────────────────────────────────

describe("ingestGroupStageStandings()", () => {
  const extIdMap = new Map([
    [759, "BRA"],
    [762, "ARG"],
    [777, "GER"],
    [773, "FRA"],
  ]);

  const fullyPlayed = [
    { id: 759, name: "Brazil", playedGames: 3 },
    { id: 762, name: "Argentina", playedGames: 3 },
    { id: 777, name: "Germany", playedGames: 3 },
    { id: 773, name: "France", playedGames: 3 },
  ];

  it("qualifies top 2 teams in a completed 4-team group", async () => {
    const standings = [makeStandings("GROUP_A", fullyPlayed)];
    const roomCountryCodes = new Set(["BRA", "ARG", "GER", "FRA"]);
    const existingQuals = new Map([
      ["BRA", null as boolean | null],
      ["ARG", null as boolean | null],
      ["GER", null as boolean | null],
      ["FRA", null as boolean | null],
    ]);

    const admin = {
      from(table: string) {
        const updates: object[] = [];
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          update(vals: object) {
            updates.push({ table, vals });
            return {
              eq() { return { eq() { return Promise.resolve({ error: null }); } }; },
            };
          },
        };
      },
    };

    const result = await ingestGroupStageStandings(
      ROOM_ID,
      standings,
      roomCountryCodes,
      extIdMap,
      existingQuals,
      admin as any
    );

    expect(result.countriesUpdated).toBe(4); // 2 qualified + 2 eliminated
  });

  it("skips incomplete groups", async () => {
    const partiallyPlayed = [
      { id: 759, name: "Brazil", playedGames: 1 },
      { id: 762, name: "Argentina", playedGames: 1 },
      { id: 777, name: "Germany", playedGames: 1 },
      { id: 773, name: "France", playedGames: 1 },
    ];
    const standings = [makeStandings("GROUP_A", partiallyPlayed)];
    const admin = { from() { return { select() { return this; }, eq() { return this; }, maybeSingle: () => Promise.resolve({ data: null }), update() { return { eq() { return { eq() { return Promise.resolve({ error: null }); } }; } }; } }; } };

    const result = await ingestGroupStageStandings(
      ROOM_ID,
      standings,
      new Set(["BRA", "ARG"]),
      extIdMap,
      new Map([["BRA", null], ["ARG", null]]),
      admin as any
    );

    expect(result.skippedIncomplete).toBe(1);
    expect(result.countriesUpdated).toBe(0);
  });

  it("is idempotent — skips already-decided countries", async () => {
    const standings = [makeStandings("GROUP_A", fullyPlayed)];
    const existingQuals = new Map<string, boolean | null>([
      ["BRA", true],   // already decided
      ["ARG", true],   // already decided
      ["GER", false],  // already decided
      ["FRA", false],  // already decided
    ]);

    let updateCallCount = 0;
    const admin = {
      from() {
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle: () => Promise.resolve({ data: null }),
          update() {
            updateCallCount++;
            return { eq() { return { eq() { return Promise.resolve({ error: null }); } }; } };
          },
        };
      },
    };

    const result = await ingestGroupStageStandings(
      ROOM_ID,
      standings,
      new Set(["BRA", "ARG", "GER", "FRA"]),
      extIdMap,
      existingQuals,
      admin as any
    );

    expect(result.countriesUpdated).toBe(0);
    expect(updateCallCount).toBe(0);
  });

  it("skips countries not in the room", async () => {
    const standings = [makeStandings("GROUP_A", fullyPlayed)];
    // Only BRA and ARG are in this room
    const roomCountryCodes = new Set(["BRA", "ARG"]);
    const existingQuals = new Map<string, boolean | null>([
      ["BRA", null],
      ["ARG", null],
    ]);

    let updateCallCount = 0;
    const admin = {
      from() {
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle: () => Promise.resolve({ data: null }),
          update() {
            updateCallCount++;
            return { eq() { return { eq() { return Promise.resolve({ error: null }); } }; } };
          },
        };
      },
    };

    await ingestGroupStageStandings(
      ROOM_ID,
      standings,
      roomCountryCodes,
      extIdMap,
      existingQuals,
      admin as any
    );

    // Only BRA and ARG should be updated (GER and FRA are not in the room)
    expect(updateCallCount).toBe(2);
  });

  it("skips standings with no group (aggregate standings)", async () => {
    const standings: FdStandingGroup[] = [
      { stage: "GROUP_STAGE", type: "TOTAL", group: null, table: [] },
    ];

    const result = await ingestGroupStageStandings(
      ROOM_ID,
      standings,
      new Set(["BRA"]),
      extIdMap,
      new Map([["BRA", null]]),
      { from() { return { select() { return this; }, eq() { return this; }, maybeSingle: () => Promise.resolve({ data: null }), update() { return { eq() { return { eq() { return Promise.resolve({}); } }; } }; } }; } } as any
    );

    expect(result.countriesUpdated).toBe(0);
  });
});
