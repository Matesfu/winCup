import { redirect } from "next/navigation";
import Link from "next/link";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import {
  formatAssignmentMode,
  hasPublicRoomFilters,
  parsePublicRoomFilters,
  toDateBoundary,
  type PublicRoomSearchParams,
} from "@/lib/public-room-filters";
import type { RoomPublic } from "@/lib/types/database";

export const metadata = { title: "Dashboard — WinCup" };

type MaybePromise<T> = T | Promise<T>;

type RoomRow = Pick<
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

type DashboardRoom = RoomRow & {
  playerCount: number;
  countryCount: number;
  userRole: "host" | "player" | "public";
};

interface SupabaseQuery<TResult> extends PromiseLike<TResult> {
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

interface SupabaseReader {
  from<TResult>(table: string): SupabaseQuery<TResult>;
}

interface DashboardPageProps {
  searchParams?: MaybePromise<PublicRoomSearchParams>;
}

const ROOM_COLUMNS =
  "id,code,status,host_user_id,host_name,room_name,visibility,assignment_mode,win_rule,stake_amount,created_at,winner_player_id";

const STATUS_LABEL: Record<string, string> = {
  lobby: "Lobby",
  drawn: "Draw",
  group_stage: "Group Stage",
  knockout: "Knockout",
  finished: "Finished",
};

const STATUS_COLOR: Record<string, string> = {
  lobby: "bg-white/10 text-muted",
  drawn: "bg-blue-500/15 text-blue-300",
  group_stage: "bg-amber-500/15 text-amber-300",
  knockout: "bg-orange-500/15 text-orange-300",
  finished: "bg-success/15 text-success",
};

function roomRoute(room: { id: string; status: string }): string {
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

async function withRoomCounts(admin: SupabaseReader, rooms: DashboardRoom[]) {
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

function toDashboardRoom(
  room: RoomRow,
  userRole: DashboardRoom["userRole"]
): DashboardRoom {
  return {
    ...room,
    userRole,
    playerCount: 0,
    countryCount: 0,
  };
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?redirectTo=/dashboard");

  const filters = parsePublicRoomFilters(searchParams ? await searchParams : {});
  const admin = createAdminClient() as unknown as SupabaseReader;
  const sessionDb = supabase as unknown as SupabaseReader;

  const { data: profile } = await sessionDb
    .from<{ data: { username: string } | null }>("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  const { data: playerRows } = await admin
    .from<{ data: { room_id: string }[] | null }>("players")
    .select("room_id")
    .eq("user_id", user.id);

  const joinedRoomIds = [...new Set((playerRows ?? []).map((player) => player.room_id))];

  const [joinedResult, hostedResult] = await Promise.all([
    joinedRoomIds.length > 0
      ? admin
          .from<{ data: RoomRow[] | null }>("rooms")
          .select(ROOM_COLUMNS)
          .in("id", joinedRoomIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as RoomRow[] }),
    admin
      .from<{ data: RoomRow[] | null }>("rooms")
      .select(ROOM_COLUMNS)
      .eq("host_user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const roomMap = new Map<string, DashboardRoom>();
  for (const room of hostedResult.data ?? []) {
    roomMap.set(room.id, toDashboardRoom(room, "host"));
  }
  for (const room of joinedResult.data ?? []) {
    if (!roomMap.has(room.id)) {
      roomMap.set(
        room.id,
        toDashboardRoom(room, room.host_user_id === user.id ? "host" : "player")
      );
    }
  }

  const myRooms = await withRoomCounts(
    admin,
    [...roomMap.values()].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  );

  let publicQuery = admin
    .from<{ data: RoomRow[] | null }>("rooms")
    .select(ROOM_COLUMNS)
    .eq("visibility", "public")
    .eq("status", "lobby");

  if (filters.search) {
    publicQuery = publicQuery.ilike("room_name", `%${filters.search}%`);
  }
  if (filters.assignmentMode !== "all") {
    publicQuery = publicQuery.eq("assignment_mode", filters.assignmentMode);
  }
  if (filters.minStake !== null) {
    publicQuery = publicQuery.gte("stake_amount", filters.minStake);
  }
  if (filters.maxStake !== null) {
    publicQuery = publicQuery.lte("stake_amount", filters.maxStake);
  }
  if (filters.dateFrom) {
    publicQuery = publicQuery.gte("created_at", toDateBoundary(filters.dateFrom, "start"));
  }
  if (filters.dateTo) {
    publicQuery = publicQuery.lte("created_at", toDateBoundary(filters.dateTo, "end"));
  }

  switch (filters.sort) {
    case "oldest":
      publicQuery = publicQuery.order("created_at", { ascending: true });
      break;
    case "stake_high":
      publicQuery = publicQuery
        .order("stake_amount", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      break;
    case "stake_low":
      publicQuery = publicQuery
        .order("stake_amount", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      break;
    default:
      publicQuery = publicQuery.order("created_at", { ascending: false });
  }

  const { data: publicRows } = await publicQuery.limit(50);
  const myRoomIds = new Set(myRooms.map((room) => room.id));
  const publicRooms = await withRoomCounts(
    admin,
    (publicRows ?? [])
      .filter((room) => !myRoomIds.has(room.id))
      .map((room) => toDashboardRoom(room, "public"))
  );

  const activeRooms = myRooms.filter((room) => room.status !== "finished");
  const finishedRooms = myRooms.filter((room) => room.status === "finished");
  const hasFilters = hasPublicRoomFilters(filters);

  return (
    <main className="min-h-screen bg-background">
      <nav className="sticky top-0 z-30 border-b border-white/5 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-extrabold text-gold">
            <span aria-hidden="true">🏆</span>
            <span>WinCup</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted sm:block">
              <span className="font-medium text-white">{profile?.username ?? user.email}</span>
            </span>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </nav>

      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-gold">
              Dashboard
            </p>
            <h1 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">
              Welcome back, {profile?.username ?? "player"} 👋
            </h1>
            <p className="mt-1 text-sm text-muted">
              Your active rooms stay on top. Public rooms below are still waiting for players.
            </p>
          </div>
          <div className="flex gap-2">
            <Button href="/room/create" variant="primary" size="sm">
              + Create Room
            </Button>
            <Button href="/room/join" variant="outline" size="sm">
              Join by Code
            </Button>
          </div>
        </div>

        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted">
              My Rooms ({myRooms.length})
            </h2>
            {activeRooms.length > 0 && (
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-muted">
                {activeRooms.length} active
              </span>
            )}
          </div>

          {activeRooms.length > 0 || finishedRooms.length > 0 ? (
            <div className="flex flex-col gap-3">
              {activeRooms.map((room) => (
                <RoomCard key={room.id} room={room} />
              ))}
              {finishedRooms.map((room) => (
                <RoomCard key={room.id} room={room} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/8 bg-surface p-6 text-center">
              <div className="text-4xl" aria-hidden="true">🏟️</div>
              <h3 className="mt-3 text-lg font-bold text-white">No rooms yet</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                Create a room, join by code, or pick a public room from discovery.
              </p>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted">
                Public Rooms Waiting ({publicRooms.length})
              </h2>
              <p className="mt-1 text-sm text-muted">
                Filter by stake, assignment style, creation date, or room name.
              </p>
            </div>
            {hasFilters && (
              <Link href="/dashboard" className="text-sm font-semibold text-gold hover:underline">
                Clear filters
              </Link>
            )}
          </div>

          <PublicRoomFiltersForm filters={filters} />

          {publicRooms.length > 0 ? (
            <div className="flex flex-col gap-3">
              {publicRooms.map((room) => (
                <RoomCard key={room.id} room={room} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/8 bg-surface/70 p-6 text-center">
              <p className="text-sm font-semibold text-white">
                {hasFilters ? "No public rooms match those filters." : "No public rooms are waiting right now."}
              </p>
              <p className="mt-1 text-sm text-muted">
                {hasFilters
                  ? "Try a wider stake range or clear the search."
                  : "Create a public room and it will appear here while it is still in the lobby."}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function PublicRoomFiltersForm({
  filters,
}: {
  filters: ReturnType<typeof parsePublicRoomFilters>;
}) {
  const inputClass =
    "h-10 rounded-xl border border-white/10 bg-background px-3 text-sm text-white placeholder:text-muted outline-none transition-colors focus:border-gold focus:ring-1 focus:ring-gold";
  const labelClass = "flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted";

  return (
    <form
      method="get"
      className="grid gap-3 rounded-2xl border border-white/8 bg-surface p-4 md:grid-cols-12"
    >
      <label className={`${labelClass} md:col-span-4`}>
        Room name
        <input
          className={inputClass}
          type="search"
          name="q"
          defaultValue={filters.search}
          placeholder="Search public rooms"
        />
      </label>

      <label className={`${labelClass} md:col-span-2`}>
        Mode
        <select className={inputClass} name="mode" defaultValue={filters.assignmentMode}>
          <option value="all">All</option>
          <option value="random">Random</option>
          <option value="player_choice">Player choice</option>
        </select>
      </label>

      <label className={`${labelClass} md:col-span-2`}>
        Min stake
        <input
          className={inputClass}
          type="number"
          min="0"
          step="1"
          name="minStake"
          defaultValue={filters.minStake ?? ""}
          placeholder="0"
        />
      </label>

      <label className={`${labelClass} md:col-span-2`}>
        Max stake
        <input
          className={inputClass}
          type="number"
          min="0"
          step="1"
          name="maxStake"
          defaultValue={filters.maxStake ?? ""}
          placeholder="Any"
        />
      </label>

      <label className={`${labelClass} md:col-span-2`}>
        Sort
        <select className={inputClass} name="sort" defaultValue={filters.sort}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="stake_high">Stake high</option>
          <option value="stake_low">Stake low</option>
        </select>
      </label>

      <label className={`${labelClass} md:col-span-3`}>
        From
        <input className={inputClass} type="date" name="from" defaultValue={filters.dateFrom} />
      </label>

      <label className={`${labelClass} md:col-span-3`}>
        To
        <input className={inputClass} type="date" name="to" defaultValue={filters.dateTo} />
      </label>

      <div className="flex items-end gap-2 md:col-span-6">
        <Button type="submit" variant="primary" size="sm" className="h-10">
          Apply filters
        </Button>
        <Button href="/dashboard" variant="ghost" size="sm" className="h-10">
          Reset
        </Button>
      </div>
    </form>
  );
}

function RoomCard({ room }: { room: DashboardRoom }) {
  const statusLabel = STATUS_LABEL[room.status] ?? room.status;
  const statusColor = STATUS_COLOR[room.status] ?? "bg-white/10 text-muted";
  const route = room.userRole === "public" ? `/room/${room.id}/join` : roomRoute(room);
  const cta = room.userRole === "public"
    ? "Join Room"
    : room.status === "finished"
      ? "View Results"
      : "Enter Room";
  const createdLabel = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(room.created_at));

  return (
    <div className="group relative flex flex-col gap-3 rounded-2xl border border-white/8 bg-surface p-4 transition-all hover:border-gold/30 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-base font-extrabold text-white">
            {room.room_name}
          </span>
          <span className="font-mono text-sm font-extrabold tracking-wider text-gold">
            {room.code}
          </span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor}`}>
            {statusLabel}
          </span>
          {room.userRole === "host" && (
            <span className="inline-flex items-center rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold">
              HOST
            </span>
          )}
          {room.userRole === "public" && (
            <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
              PUBLIC
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
          <span>👤 {room.host_name}</span>
          <span>👥 {room.playerCount}/{room.countryCount} players</span>
          <span>{formatAssignmentMode(room.assignment_mode)}</span>
          <span>{room.win_rule === "strict" ? "🏆 Must Win" : "⚔️ Last Standing"}</span>
          {room.stake_amount !== null && <span>💰 £{room.stake_amount}</span>}
          <span>Created {createdLabel}</span>
        </div>

        {room.status === "finished" && room.winner_player_id && (
          <p className="text-xs text-success">✓ Game complete</p>
        )}
        {room.status === "finished" && !room.winner_player_id && (
          <p className="text-xs text-muted">Stakes returned</p>
        )}
      </div>

      <div className="shrink-0">
        <Link
          href={route}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gold/40 bg-gold/5 px-4 py-2 text-sm font-semibold text-gold transition-all hover:border-gold hover:bg-gold/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          {cta}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
