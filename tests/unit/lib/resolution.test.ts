import { resolveWinner } from "@/lib/resolution";
import type { RoomTeam } from "@/lib/types/database";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTeam(
  overrides: Partial<Pick<RoomTeam, "player_id" | "current_stage" | "is_eliminated">> = {}
): Pick<RoomTeam, "player_id" | "current_stage" | "is_eliminated"> {
  return {
    player_id: null,
    current_stage: "r16",
    is_eliminated: false,
    ...overrides,
  };
}

// ── strict win rule ───────────────────────────────────────────────────────────

describe("resolveWinner() — strict", () => {
  it("returns winner when champion is player-owned", () => {
    const teams = [
      makeTeam({ current_stage: "champion", player_id: "player-1" }),
      makeTeam({ is_eliminated: true }),
    ];
    const result = resolveWinner("strict", teams);
    expect(result?.winnerPlayerId).toBe("player-1");
  });

  it("returns null winner when champion is a filler (no player_id)", () => {
    const teams = [
      makeTeam({ current_stage: "champion", player_id: null }),
      makeTeam({ is_eliminated: true, player_id: "player-1" }),
    ];
    const result = resolveWinner("strict", teams);
    expect(result).not.toBeNull();
    expect(result?.winnerPlayerId).toBeNull();
  });

  it("returns null (still ongoing) when no champion yet", () => {
    const teams = [
      makeTeam({ current_stage: "sf", player_id: "player-1" }),
      makeTeam({ current_stage: "sf", player_id: "player-2" }),
    ];
    expect(resolveWinner("strict", teams)).toBeNull();
  });

  it("winner message contains 🏆 emoji", () => {
    const teams = [makeTeam({ current_stage: "champion", player_id: "p1" })];
    expect(resolveWinner("strict", teams)?.message).toContain("🏆");
  });

  it("no-winner message mentions 'stakes returned'", () => {
    const teams = [makeTeam({ current_stage: "champion", player_id: null })];
    const msg = resolveWinner("strict", teams)?.message ?? "";
    expect(msg.toLowerCase()).toContain("stakes");
  });

  it("empty room teams returns null", () => {
    expect(resolveWinner("strict", [])).toBeNull();
  });
});

// ── last_standing win rule ────────────────────────────────────────────────────

describe("resolveWinner() — last_standing", () => {
  it("returns winner when exactly 1 alive player team", () => {
    const teams = [
      makeTeam({ player_id: "player-1", is_eliminated: false, current_stage: "champion" }),
      makeTeam({ player_id: "player-2", is_eliminated: true }),
      makeTeam({ player_id: null, is_eliminated: false }),
    ];
    const result = resolveWinner("last_standing", teams);
    expect(result?.winnerPlayerId).toBe("player-1");
  });

  it("returns null when 0 alive player teams", () => {
    const teams = [
      makeTeam({ player_id: "player-1", is_eliminated: true }),
      makeTeam({ player_id: null, is_eliminated: false, current_stage: "champion" }),
    ];
    expect(resolveWinner("last_standing", teams)).toBeNull();
  });

  it("returns null when 2+ alive player teams (still playing)", () => {
    const teams = [
      makeTeam({ player_id: "player-1", is_eliminated: false }),
      makeTeam({ player_id: "player-2", is_eliminated: false }),
    ];
    expect(resolveWinner("last_standing", teams)).toBeNull();
  });

  it("winner message mentions 'standing'", () => {
    const teams = [makeTeam({ player_id: "p1", is_eliminated: false, current_stage: "champion" })];
    expect(resolveWinner("last_standing", teams)?.message?.toLowerCase()).toContain("standing");
  });

  it("filler teams (null player_id) are ignored in alive count", () => {
    const teams = [
      makeTeam({ player_id: null, is_eliminated: false, current_stage: "champion" }),
      makeTeam({ player_id: null, is_eliminated: false }),
    ];
    // 0 alive player teams → null
    expect(resolveWinner("last_standing", teams)).toBeNull();
  });

  it("eliminated filler not counted as alive player team", () => {
    const teams = [
      makeTeam({ player_id: "p1", is_eliminated: false }),
      makeTeam({ player_id: null, is_eliminated: true }),
    ];
    const result = resolveWinner("last_standing", teams);
    expect(result?.winnerPlayerId).toBe("p1");
  });
});
