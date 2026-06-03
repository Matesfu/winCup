import type { AssignmentMode, RoomPublic, RoomStatus } from "@/lib/types/database";

export type RoomRole = "host" | "player" | "public";

export type RoomRow = Pick<
  RoomPublic,
  | "id"
  | "code"
  | "status"
  | "host_user_id"
  | "host_name"
  | "room_name"
  | "visibility"
  | "assignment_mode"
  | "win_rule"
  | "stake_amount"
  | "created_at"
  | "winner_player_id"
>;

export type RoomListItem = RoomRow & {
  playerCount: number;
  countryCount: number;
  userRole: RoomRole;
};

export interface SupabaseQuery<TResult> extends PromiseLike<TResult> {
  select(columns: string): SupabaseQuery<TResult>;
  eq(column: string, value: string | number): SupabaseQuery<TResult>;
  in(column: string, values: string[]): SupabaseQuery<TResult>;
  ilike(column: string, pattern: string): SupabaseQuery<TResult>;
  gte(column: string, value: string | number): SupabaseQuery<TResult>;
  lte(column: string, value: string | number): SupabaseQuery<TResult>;
  order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): SupabaseQuery<TResult>;
  limit(count: number): SupabaseQuery<TResult>;
  maybeSingle(): Promise<TResult>;
}

export interface SupabaseRoomReader {
  from<TResult>(table: string): SupabaseQuery<TResult>;
}

export const ROOM_COLUMNS =
  "id,code,status,host_user_id,host_name,room_name,visibility,assignment_mode,win_rule,stake_amount,created_at,winner_player_id";

export const ROOM_STATUS_LABEL: Record<RoomStatus, string> = {
  lobby: "Waiting",
  drawn: "Draw",
  group_stage: "Group Stage",
  knockout: "Knockout",
  finished: "Finished",
};

export const ROOM_STATUS_COLOR: Record<RoomStatus, string> = {
  lobby: "bg-white/10 text-muted",
  drawn: "bg-blue-500/15 text-blue-300",
  group_stage: "bg-amber-500/15 text-amber-300",
  knockout: "bg-orange-500/15 text-orange-300",
  finished: "bg-success/15 text-success",
};

export function roomRoute(room: { id: string; status: string }): string {
  switch (room.status) {
    case "lobby":
      return `/room/${room.id}/lobby`;
    case "drawn":
      return `/room/${room.id}/draw`;
    case "group_stage":
      return `/room/${room.id}/group-stage`;
    case "knockout":
      return `/room/${room.id}/ladder`;
    case "finished":
      return `/room/${room.id}/winner`;
    default:
      return `/room/${room.id}/lobby`;
  }
}

export function formatAssignmentMode(mode: AssignmentMode): string {
  return mode === "player_choice" ? "Player choice" : "Random assignment";
}

export function toRoomListItem(room: RoomRow, userRole: RoomRole): RoomListItem {
  return {
    ...room,
    userRole,
    playerCount: 0,
    countryCount: 0,
  };
}

export async function withRoomCounts(
  admin: SupabaseRoomReader,
  rooms: RoomListItem[]
) {
  const ids = rooms.map((room) => room.id);
  if (ids.length === 0) return rooms;

  const [playerCounts, countryCounts] = await Promise.all([
    admin
      .from<{ data: { room_id: string }[] | null }>("players")
      .select("room_id")
      .in("room_id", ids),
    admin
      .from<{ data: { room_id: string }[] | null }>("room_countries")
      .select("room_id")
      .in("room_id", ids),
  ]);

  const playersByRoom = new Map<string, number>();
  for (const player of playerCounts.data ?? []) {
    playersByRoom.set(player.room_id, (playersByRoom.get(player.room_id) ?? 0) + 1);
  }

  const countriesByRoom = new Map<string, number>();
  for (const country of countryCounts.data ?? []) {
    countriesByRoom.set(country.room_id, (countriesByRoom.get(country.room_id) ?? 0) + 1);
  }

  return rooms.map((room) => ({
    ...room,
    playerCount: playersByRoom.get(room.id) ?? 0,
    countryCount: countriesByRoom.get(room.id) ?? 0,
  }));
}

export function createdDateLabel(createdAt: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(createdAt));
}
