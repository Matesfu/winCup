import type { AssignmentMode, RoomStatus } from "@/lib/types/database";
import type { RoomListItem } from "@/lib/room-list";

export type MyRoomRoleFilter = "all" | "host" | "player";
export type MyRoomStatusFilter =
  | "all"
  | "waiting"
  | "active"
  | "finished"
  | RoomStatus;
export type MyRoomSort = "recent" | "oldest" | "stake_high" | "stake_low";
export type MyRoomAssignmentFilter = AssignmentMode | "all";

export interface MyRoomFilters {
  search: string;
  role: MyRoomRoleFilter;
  status: MyRoomStatusFilter;
  assignmentMode: MyRoomAssignmentFilter;
  sort: MyRoomSort;
}

type SearchParamsValue = string | string[] | undefined;
export type MyRoomSearchParams = Record<string, SearchParamsValue>;

const ROLES = new Set<MyRoomRoleFilter>(["all", "host", "player"]);
const STATUSES = new Set<MyRoomStatusFilter>([
  "all",
  "waiting",
  "active",
  "finished",
  "lobby",
  "drawn",
  "group_stage",
  "knockout",
]);
const ASSIGNMENT_MODES = new Set<MyRoomAssignmentFilter>([
  "all",
  "random",
  "player_choice",
]);
const SORTS = new Set<MyRoomSort>(["recent", "oldest", "stake_high", "stake_low"]);

function first(value: SearchParamsValue): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function parseMyRoomFilters(params: MyRoomSearchParams = {}): MyRoomFilters {
  const role = first(params.role) as MyRoomRoleFilter;
  const status = first(params.status) as MyRoomStatusFilter;
  const mode = first(params.mode) as MyRoomAssignmentFilter;
  const sort = first(params.sort) as MyRoomSort;

  return {
    search: first(params.q).trim().slice(0, 80),
    role: ROLES.has(role) ? role : "all",
    status: STATUSES.has(status) ? status : "all",
    assignmentMode: ASSIGNMENT_MODES.has(mode) ? mode : "all",
    sort: SORTS.has(sort) ? sort : "recent",
  };
}

export function hasMyRoomFilters(filters: MyRoomFilters): boolean {
  return Boolean(
    filters.search ||
      filters.role !== "all" ||
      filters.status !== "all" ||
      filters.assignmentMode !== "all" ||
      filters.sort !== "recent"
  );
}

function statusMatches(roomStatus: RoomStatus, filter: MyRoomStatusFilter) {
  if (filter === "all") return true;
  if (filter === "waiting") return roomStatus === "lobby";
  if (filter === "active") {
    return roomStatus === "drawn" || roomStatus === "group_stage" || roomStatus === "knockout";
  }
  return roomStatus === filter;
}

export function filterMyRooms(rooms: RoomListItem[], filters: MyRoomFilters) {
  const search = filters.search.toLowerCase();

  return rooms
    .filter((room) => {
      if (filters.role !== "all" && room.userRole !== filters.role) return false;
      if (!statusMatches(room.status, filters.status)) return false;
      if (filters.assignmentMode !== "all" && room.assignment_mode !== filters.assignmentMode) return false;
      if (!search) return true;

      return (
        room.room_name.toLowerCase().includes(search) ||
        room.code.toLowerCase().includes(search)
      );
    })
    .sort((left, right) => {
      if (filters.sort === "oldest") {
        return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
      }
      if (filters.sort === "stake_high") {
        return (right.stake_amount ?? 0) - (left.stake_amount ?? 0);
      }
      if (filters.sort === "stake_low") {
        return (left.stake_amount ?? 0) - (right.stake_amount ?? 0);
      }

      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });
}
