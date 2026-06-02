import type { AssignmentMode } from "@/lib/types/database";

export type PublicRoomSort = "newest" | "oldest" | "stake_high" | "stake_low";
export type PublicAssignmentFilter = AssignmentMode | "all";

export interface PublicRoomFilters {
  search: string;
  assignmentMode: PublicAssignmentFilter;
  minStake: number | null;
  maxStake: number | null;
  dateFrom: string;
  dateTo: string;
  sort: PublicRoomSort;
}

type SearchParamsValue = string | string[] | undefined;
export type PublicRoomSearchParams = Record<string, SearchParamsValue>;

const ASSIGNMENT_MODES = new Set<PublicAssignmentFilter>([
  "all",
  "random",
  "player_choice",
]);

const SORTS = new Set<PublicRoomSort>([
  "newest",
  "oldest",
  "stake_high",
  "stake_low",
]);

function first(value: SearchParamsValue): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function parseStake(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function parseDate(value: string): string {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return "";
  return trimmed;
}

export function parsePublicRoomFilters(
  params: PublicRoomSearchParams = {}
): PublicRoomFilters {
  const assignmentMode = first(params.mode) as PublicAssignmentFilter;
  const sort = first(params.sort) as PublicRoomSort;

  return {
    search: first(params.q).trim().slice(0, 80),
    assignmentMode: ASSIGNMENT_MODES.has(assignmentMode) ? assignmentMode : "all",
    minStake: parseStake(first(params.minStake)),
    maxStake: parseStake(first(params.maxStake)),
    dateFrom: parseDate(first(params.from)),
    dateTo: parseDate(first(params.to)),
    sort: SORTS.has(sort) ? sort : "newest",
  };
}

export function toDateBoundary(date: string, boundary: "start" | "end"): string {
  return `${date}T${boundary === "start" ? "00:00:00.000" : "23:59:59.999"}Z`;
}

export function formatAssignmentMode(mode: AssignmentMode): string {
  return mode === "player_choice" ? "Player choice" : "Random assignment";
}

export function hasPublicRoomFilters(filters: PublicRoomFilters): boolean {
  return Boolean(
    filters.search ||
      filters.assignmentMode !== "all" ||
      filters.minStake !== null ||
      filters.maxStake !== null ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.sort !== "newest"
  );
}
