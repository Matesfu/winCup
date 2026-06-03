import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app/AppShell";
import { RoomCard } from "@/components/rooms/RoomCard";
import { RoomEmptyState } from "@/components/rooms/RoomEmptyState";
import { PublicRoomDiscoveryControls } from "./_components/PublicRoomDiscoveryControls";
import { createAdminClient, createSessionClient } from "@/lib/supabase/server";
import {
  hasPublicRoomFilters,
  parsePublicRoomFilters,
  toDateBoundary,
  type PublicRoomSearchParams,
} from "@/lib/public-room-filters";
import {
  ROOM_COLUMNS,
  toRoomListItem,
  withRoomCounts,
  type RoomRow,
  type SupabaseRoomReader,
} from "@/lib/room-list";

export const metadata = { title: "Discover Rooms — WinCup" };

type MaybePromise<T> = T | Promise<T>;

interface DashboardPageProps {
  searchParams?: MaybePromise<PublicRoomSearchParams>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?redirectTo=/dashboard");

  const filters = parsePublicRoomFilters(searchParams ? await searchParams : {});
  const admin = createAdminClient() as unknown as SupabaseRoomReader;
  const sessionDb = supabase as unknown as SupabaseRoomReader;

  const { data: profile } = await sessionDb
    .from<{ data: { username: string } | null }>("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  const [playerRowsResult, hostedRowsResult] = await Promise.all([
    admin
      .from<{ data: { room_id: string }[] | null }>("players")
      .select("room_id")
      .eq("user_id", user.id),
    admin
      .from<{ data: Pick<RoomRow, "id">[] | null }>("rooms")
      .select("id")
      .eq("host_user_id", user.id),
  ]);

  const myRoomIds = new Set([
    ...((playerRowsResult.data ?? []).map((player) => player.room_id)),
    ...((hostedRowsResult.data ?? []).map((room) => room.id)),
  ]);

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
  const publicRooms = await withRoomCounts(
    admin,
    (publicRows ?? [])
      .filter((room) => !myRoomIds.has(room.id))
      .map((room) => toRoomListItem(room, "public"))
  );
  const hasFilters = hasPublicRoomFilters(filters);
  const userLabel = profile?.username ?? user.email ?? "player";

  return (
    <AppShell userLabel={userLabel}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:py-8">
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-gold">
                Discover
              </p>
              <h1 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">
                Find a room waiting for players
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted">
                Browse public rooms, compare stakes, and join before the host starts the game.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Link
                href="/room/create"
                className="inline-flex items-center justify-center rounded-2xl bg-gold px-4 py-3 text-sm font-black text-black transition-colors hover:brightness-110"
              >
                + Create
              </Link>
              <Link
                href="/room/join"
                className="inline-flex items-center justify-center rounded-2xl border border-gold/40 px-4 py-3 text-sm font-bold text-gold transition-colors hover:bg-gold/10"
              >
                Join Code
              </Link>
            </div>
          </div>

          <PublicRoomDiscoveryControls filters={filters} />
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted">
                Public Rooms Waiting ({publicRooms.length})
              </h2>
              <p className="mt-1 text-xs text-muted">
                Your own hosted or joined rooms live in My Rooms.
              </p>
            </div>
            {hasFilters && (
              <Link href="/dashboard" className="text-sm font-semibold text-gold hover:underline">
                Clear filters
              </Link>
            )}
          </div>

          {publicRooms.length > 0 ? (
            <div className="flex flex-col gap-3">
              {publicRooms.map((room) => (
                <RoomCard key={room.id} room={room} />
              ))}
            </div>
          ) : (
            <RoomEmptyState
              icon={hasFilters ? "🔎" : "🌍"}
              title={hasFilters ? "No rooms match those filters" : "No public rooms are waiting"}
              message={
                hasFilters
                  ? "Try a wider stake range, clear search, or switch assignment mode."
                  : "Create a public room and it appears here until the game starts."
              }
              primaryHref={hasFilters ? "/dashboard" : "/room/create"}
              primaryLabel={hasFilters ? "Clear filters" : "Create Public Room"}
            />
          )}
        </section>
      </div>
    </AppShell>
  );
}
