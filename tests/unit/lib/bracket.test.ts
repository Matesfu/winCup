import {
  getStartingStage,
  getActiveStages,
  assignSequentialPositions,
  buildRoomTeamInserts,
  getNextStageInfo,
  positionAtStage,
  computeBracketMatchups,
  STAGE_ORDER,
} from "@/lib/bracket";
import type { RoomTeam } from "@/lib/types/database";

// ── getStartingStage ──────────────────────────────────────────────────────────

describe("getStartingStage()", () => {
  it("16 teams → 'r16'", () => {
    expect(getStartingStage(16)).toBe("r16");
  });
  it("8 teams → 'qf'", () => {
    expect(getStartingStage(8)).toBe("qf");
  });
  it("4 teams → 'sf'", () => {
    expect(getStartingStage(4)).toBe("sf");
  });
  it("2 teams → 'final'", () => {
    expect(getStartingStage(2)).toBe("final");
  });
  it("20 teams (rounds up to 16+ bracket) → 'r16'", () => {
    expect(getStartingStage(20)).toBe("r16");
  });
});

// ── getActiveStages ───────────────────────────────────────────────────────────

describe("getActiveStages()", () => {
  it("r16 → all 4 stages", () => {
    expect(getActiveStages("r16")).toEqual(["r16", "qf", "sf", "final"]);
  });
  it("qf → 3 stages", () => {
    expect(getActiveStages("qf")).toEqual(["qf", "sf", "final"]);
  });
  it("sf → 2 stages", () => {
    expect(getActiveStages("sf")).toEqual(["sf", "final"]);
  });
  it("final → just final", () => {
    expect(getActiveStages("final")).toEqual(["final"]);
  });
});

// ── positionAtStage ───────────────────────────────────────────────────────────

describe("positionAtStage()", () => {
  it("R16 pos 1 → QF pos 1", () => {
    expect(positionAtStage(1, "qf", "r16")).toBe(1);
  });
  it("R16 pos 2 → QF pos 1 (pair shares slot)", () => {
    expect(positionAtStage(2, "qf", "r16")).toBe(1);
  });
  it("R16 pos 3 → QF pos 2", () => {
    expect(positionAtStage(3, "qf", "r16")).toBe(2);
  });
  it("R16 pos 4 → QF pos 2", () => {
    expect(positionAtStage(4, "qf", "r16")).toBe(2);
  });
  it("R16 pos 1 → SF pos 1", () => {
    expect(positionAtStage(1, "sf", "r16")).toBe(1);
  });
  it("R16 pos 4 → SF pos 1", () => {
    expect(positionAtStage(4, "sf", "r16")).toBe(1);
  });
  it("R16 pos 5 → SF pos 2", () => {
    expect(positionAtStage(5, "sf", "r16")).toBe(2);
  });
  it("same stage: pos unchanged", () => {
    expect(positionAtStage(3, "r16", "r16")).toBe(3);
  });
});

// ── getNextStageInfo ──────────────────────────────────────────────────────────

describe("getNextStageInfo()", () => {
  it("r16 pos 1 → qf pos 1", () => {
    expect(getNextStageInfo("r16", 1)).toEqual({ nextStage: "qf", nextPosition: 1 });
  });
  it("r16 pos 2 → qf pos 1 (same match, different slot)", () => {
    expect(getNextStageInfo("r16", 2)).toEqual({ nextStage: "qf", nextPosition: 1 });
  });
  it("r16 pos 3 → qf pos 2", () => {
    expect(getNextStageInfo("r16", 3)).toEqual({ nextStage: "qf", nextPosition: 2 });
  });
  it("qf pos 1 → sf pos 1", () => {
    expect(getNextStageInfo("qf", 1)).toEqual({ nextStage: "sf", nextPosition: 1 });
  });
  it("sf pos 2 → final pos 1", () => {
    expect(getNextStageInfo("sf", 2)).toEqual({ nextStage: "final", nextPosition: 1 });
  });
  it("final → null (no next stage)", () => {
    expect(getNextStageInfo("final", 1)).toBeNull();
  });
});

// ── assignSequentialPositions ─────────────────────────────────────────────────

describe("assignSequentialPositions()", () => {
  it("4 codes → positions 1-4", () => {
    const map = assignSequentialPositions(["ARG", "BRA", "FRA", "ENG"]);
    expect(map.get("ARG")).toBe(1);
    expect(map.get("BRA")).toBe(2);
    expect(map.get("FRA")).toBe(3);
    expect(map.get("ENG")).toBe(4);
  });
  it("preserves order of input array", () => {
    const codes = ["C", "A", "B"];
    const map = assignSequentialPositions(codes);
    expect(map.get("C")).toBe(1);
    expect(map.get("A")).toBe(2);
    expect(map.get("B")).toBe(3);
  });
});

// ── buildRoomTeamInserts ──────────────────────────────────────────────────────

describe("buildRoomTeamInserts()", () => {
  const ROOM_ID = "room-1";
  const CODES = ["ARG", "BRA", "FRA", "ENG"];
  const PLAYER_MAP = new Map([["ARG", "player-alice"], ["FRA", "player-bob"]]);
  const POS_MAP = new Map([["ARG", 1], ["BRA", 2], ["FRA", 3], ["ENG", 4]]);

  it("returns correct count", () => {
    expect(buildRoomTeamInserts(ROOM_ID, CODES, PLAYER_MAP, POS_MAP)).toHaveLength(4);
  });

  it("player-owned country has player_id set", () => {
    const inserts = buildRoomTeamInserts(ROOM_ID, CODES, PLAYER_MAP, POS_MAP);
    expect(inserts.find((r) => r.country_code === "ARG")?.player_id).toBe("player-alice");
  });

  it("filler country has null player_id", () => {
    const inserts = buildRoomTeamInserts(ROOM_ID, CODES, PLAYER_MAP, POS_MAP);
    expect(inserts.find((r) => r.country_code === "BRA")?.player_id).toBeNull();
  });

  it("all teams start at sf for 4 teams", () => {
    const inserts = buildRoomTeamInserts(ROOM_ID, CODES, PLAYER_MAP, POS_MAP);
    inserts.forEach((r) => expect(r.current_stage).toBe("sf"));
  });

  it("bracket positions match positionMap", () => {
    const inserts = buildRoomTeamInserts(ROOM_ID, CODES, PLAYER_MAP, POS_MAP);
    expect(inserts.find((r) => r.country_code === "FRA")?.bracket_position).toBe(3);
  });

  it("all start as not eliminated", () => {
    const inserts = buildRoomTeamInserts(ROOM_ID, CODES, PLAYER_MAP, POS_MAP);
    inserts.forEach((r) => expect(r.is_eliminated).toBe(false));
  });
});

// ── computeBracketMatchups ────────────────────────────────────────────────────

describe("computeBracketMatchups()", () => {
  function makeTeam(pos: number, stage: string, isEliminated = false): RoomTeam {
    return {
      id: `t${pos}`,
      room_id: "r1",
      country_code: `C${pos}`,
      player_id: null,
      bracket_position: pos,
      current_stage: stage as any,
      is_eliminated: isEliminated,
    };
  }

  it("returns 2 matchups for 4-team bracket at sf stage", () => {
    const teams = [1, 2, 3, 4].map((p) => makeTeam(p, "sf"));
    const matchups = computeBracketMatchups(teams, [], ["sf", "final"]);
    const sfMatchups = matchups.filter((m) => m.stage === "sf");
    expect(sfMatchups).toHaveLength(2);
  });

  it("matchOrder 1 contains positions 1 and 2", () => {
    const teams = [1, 2, 3, 4].map((p) => makeTeam(p, "sf"));
    const matchups = computeBracketMatchups(teams, [], ["sf", "final"]);
    const m1 = matchups.find((m) => m.stage === "sf" && m.matchOrder === 1);
    expect(m1?.slotA.teamCode).toBe("C1");
    expect(m1?.slotB.teamCode).toBe("C2");
  });

  it("returns 1 final matchup for 4-team bracket", () => {
    const teams = [1, 2, 3, 4].map((p) => makeTeam(p, "sf"));
    const matchups = computeBracketMatchups(teams, [], ["sf", "final"]);
    const finalMatchups = matchups.filter((m) => m.stage === "final");
    expect(finalMatchups).toHaveLength(1);
  });

  it("winner_code from matches table is surfaced correctly", () => {
    const teams = [1, 2, 3, 4].map((p) => makeTeam(p, "sf"));
    const matches = [
      {
        id: "m1", room_id: "r1", external_match_id: null,
        stage: "sf" as any, team_a_code: "C1", team_b_code: "C2",
        winner_code: "C1", bracket_position: null, match_order: 1
      }
    ];
    const matchups = computeBracketMatchups(teams, matches, ["sf", "final"]);
    const m1 = matchups.find((m) => m.stage === "sf" && m.matchOrder === 1);
    expect(m1?.winnerCode).toBe("C1");
  });

  it("returns empty array for empty roomTeams", () => {
    expect(computeBracketMatchups([], [], ["sf", "final"])).toEqual([]);
  });
});
