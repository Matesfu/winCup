/**
 * Pure bracket logic — no Supabase, no HTTP.
 * All functions are deterministic and fully unit-testable.
 *
 * POSITION MODEL:
 *   Each team has a fixed bracket_position (1..N, set when bracket is built).
 *   As they advance, current_stage changes but bracket_position stays fixed.
 *
 *   Position at stage S = ceil(original_pos / 2^stageOffset)
 *   where stageOffset = stageIndex(S) - stageIndex(startingStage)
 *
 *   Match number at stage S = ceil(posAtStage / 2)
 *   Within a match: odd posAtStage → slot A, even → slot B
 */

import type { RoomTeam, Match, RoomTeamInsert, KnockoutStage } from "@/lib/types/database";

// ─── Stage constants ──────────────────────────────────────────────────────────

export type StageKey = "r16" | "qf" | "sf" | "final";

export const STAGE_ORDER: StageKey[] = ["r16", "qf", "sf", "final"];

export const STAGE_LABELS: Record<StageKey, string> = {
  r16: "Round of 16",
  qf: "Quarter-finals",
  sf: "Semi-finals",
  final: "Final",
};

// ─── BracketSlot / BracketMatchup ─────────────────────────────────────────────

/** One team tile within a matchup */
export interface BracketSlot {
  teamCode: string | null;    // null = TBD (team not yet determined)
  playerId: string | null;    // null = filler
  playerName: string | null;  // resolved in components from playersMap
  isEliminated: boolean;
  isChampion: boolean;
  bracketPosition: number;    // original bracket position
}

/** One matchup (pair of team slots) within a stage */
export interface BracketMatchup {
  stage: StageKey;
  matchOrder: number;          // 1-based within stage
  slotA: BracketSlot;          // odd-position team
  slotB: BracketSlot;          // even-position team
  winnerCode: string | null;   // null = not yet played
  externalMatchId: number | null;
}

// ─── getStartingStage ─────────────────────────────────────────────────────────

/** Returns the first stage for a bracket with `teamCount` teams. */
export function getStartingStage(teamCount: number): StageKey {
  if (teamCount >= 16) return "r16";
  if (teamCount >= 8) return "qf";
  if (teamCount >= 4) return "sf";
  return "final";
}

/** All stages from the starting stage onwards. */
export function getActiveStages(startingStage: StageKey): StageKey[] {
  const idx = STAGE_ORDER.indexOf(startingStage);
  return STAGE_ORDER.slice(idx);
}

// ─── Position arithmetic ──────────────────────────────────────────────────────

/**
 * Returns a team's position within a given stage,
 * derived from their original bracket_position.
 */
export function positionAtStage(
  originalPos: number,
  stage: StageKey,
  startingStage: StageKey
): number {
  const startIdx = STAGE_ORDER.indexOf(startingStage);
  const stageIdx = STAGE_ORDER.indexOf(stage);
  const offset = stageIdx - startIdx;
  return Math.ceil(originalPos / Math.pow(2, offset));
}

/** Which match number (1-based) a position corresponds to at a given stage. */
export function matchOrderForPosition(posAtStage: number): number {
  return Math.ceil(posAtStage / 2);
}

/** Returns where the winner of a match advances to. Null for the Final. */
export function getNextStageInfo(
  stage: StageKey,
  posAtCurrentStage: number
): { nextStage: StageKey; nextPosition: number } | null {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx >= STAGE_ORDER.length - 1) return null;
  return {
    nextStage: STAGE_ORDER[idx + 1],
    nextPosition: Math.ceil(posAtCurrentStage / 2),
  };
}

// ─── assignSequentialPositions ────────────────────────────────────────────────

/** Assigns bracket positions 1..N sequentially (for unlinked rooms). */
export function assignSequentialPositions(
  countryCodes: string[]
): Map<string, number> {
  return new Map(countryCodes.map((code, i) => [code, i + 1]));
}

// ─── buildRoomTeamInserts ─────────────────────────────────────────────────────

/**
 * Constructs room_teams rows for the knockout bracket.
 * Player-owned countries get player_id set; others are filler (null).
 */
export function buildRoomTeamInserts(
  roomId: string,
  qualifiedCodes: string[],
  playerMap: Map<string, string>,
  positionMap: Map<string, number>
): RoomTeamInsert[] {
  const startingStage = getStartingStage(qualifiedCodes.length);
  return qualifiedCodes.map((code) => ({
    room_id: roomId,
    country_code: code,
    player_id: playerMap.get(code) ?? null,
    bracket_position: positionMap.get(code) ?? 0,
    current_stage: startingStage as KnockoutStage,
    is_eliminated: false,
  }));
}

// ─── computeBracketMatchups ───────────────────────────────────────────────────

/**
 * Derives the visual matchup layout for all active stages.
 *
 * Uses position arithmetic to determine which teams pair up at each stage.
 * Uses the matches table for winner_code (when available).
 *
 * @param roomTeams - all room_teams rows for this room
 * @param matches   - all matches rows for this room
 * @param stages    - active stages (from getActiveStages)
 */
export function computeBracketMatchups(
  roomTeams: RoomTeam[],
  matches: Match[],
  stages: StageKey[]
): BracketMatchup[] {
  if (roomTeams.length === 0) return [];

  const startingStage = getStartingStage(roomTeams.length);
  const totalTeams = roomTeams.length;
  const result: BracketMatchup[] = [];

  // Build lookup: countryCode → team
  const teamByCode = new Map(roomTeams.map((t) => [t.country_code, t]));
  // Build lookup: (stage, matchOrder) → match record
  const matchByKey = new Map(
    matches
      .filter((m) => m.match_order !== null && m.stage !== null)
      .map((m) => [`${m.stage}:${m.match_order}`, m])
  );

  for (const stage of stages) {
    const startIdx = STAGE_ORDER.indexOf(startingStage);
    const stageIdx = STAGE_ORDER.indexOf(stage);
    const offset = stageIdx - startIdx;
    const matchCount = totalTeams / Math.pow(2, offset + 1);

    for (let matchOrder = 1; matchOrder <= matchCount; matchOrder++) {
      // Original positions that land in slot A and slot B of this match
      const posAAtStage = matchOrder * 2 - 1; // odd
      const posBAtStage = matchOrder * 2;     // even

      const slotA = resolveSlot(posAAtStage, stage, startingStage, roomTeams);
      const slotB = resolveSlot(posBAtStage, stage, startingStage, roomTeams);

      // Find any match record for this matchup
      const matchRecord = matchByKey.get(`${stage}:${matchOrder}`) ?? null;

      result.push({
        stage,
        matchOrder,
        slotA,
        slotB,
        winnerCode: matchRecord?.winner_code ?? null,
        externalMatchId: matchRecord?.external_match_id ?? null,
      });
    }
  }

  return result;
}

/** Resolves which team occupies a given position-at-stage in the bracket. */
function resolveSlot(
  posAtStage: number,
  stage: StageKey,
  startingStage: StageKey,
  roomTeams: RoomTeam[]
): BracketSlot {
  const startIdx = STAGE_ORDER.indexOf(startingStage);
  const stageIdx = STAGE_ORDER.indexOf(stage);
  const offset = stageIdx - startIdx;

  // Find teams whose original position maps to this posAtStage
  // originalPos in range: [(posAtStage-1)*2^offset + 1, posAtStage * 2^offset]
  const factor = Math.pow(2, offset);
  const origLow = (posAtStage - 1) * factor + 1;
  const origHigh = posAtStage * factor;

  const candidates = roomTeams.filter(
    (t) => t.bracket_position >= origLow && t.bracket_position <= origHigh
  );

  if (candidates.length === 0) {
    return { teamCode: null, playerId: null, playerName: null, isEliminated: false, isChampion: false, bracketPosition: posAtStage };
  }

  // The winner is the one not eliminated and furthest advanced
  const alive = candidates.filter((t) => !t.is_eliminated && t.current_stage !== "out");

  if (alive.length === 0) {
    // All candidates are eliminated — show the one that survived longest
    // (the one who was in the latest stage)
    const furthest = candidates.reduce((a, b) =>
      STAGE_ORDER.indexOf(a.current_stage as StageKey) >
      STAGE_ORDER.indexOf(b.current_stage as StageKey)
        ? a
        : b
    );
    return { ...makeSlot(furthest), isEliminated: true };
  }

  if (alive.length === 1) {
    const team = alive[0];
    const teamStageIdx = STAGE_ORDER.indexOf(team.current_stage as StageKey);
    if (teamStageIdx >= stageIdx) {
      // Team has reached or passed this stage — show them
      return { ...makeSlot(team), isEliminated: false };
    }
    // Team is still in an earlier stage — show as TBD (advancing)
    return { teamCode: null, playerId: null, playerName: null, isEliminated: false, isChampion: false, bracketPosition: posAtStage };
  }

  // Multiple alive candidates: only one should be at this stage level
  const atStage = alive.find(
    (t) => STAGE_ORDER.indexOf(t.current_stage as StageKey) >= stageIdx
  );
  if (atStage) return { ...makeSlot(atStage), isEliminated: false };

  return { teamCode: null, playerId: null, playerName: null, isEliminated: false, isChampion: false, bracketPosition: posAtStage };
}

function makeSlot(team: RoomTeam): BracketSlot {
  return {
    teamCode: team.country_code,
    playerId: team.player_id,
    playerName: null,
    isEliminated: team.is_eliminated,
    isChampion: team.current_stage === "champion",
    bracketPosition: team.bracket_position,
  };
}
