import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app/AppShell";
import { RoomCard } from "@/components/rooms/RoomCard";
import { RoomEmptyState } from "@/components/rooms/RoomEmptyState";
import { createAdminClient, createSessionClient } from "@/lib/supabase/server";
import {
  ROOM_COLUMNS,
  toRoomListItem,
  withRoomCounts,
  type RoomListItem,
  type RoomRow,
  type SupabaseRoomReader,
} from "@/lib/room-list";
import {
  filterMyRooms,
  hasMyRoomFilters,
  parseMyRoomFilters,
  type MyRoomSearchParams,
} from "@/lib/my-room-filters";
import { MyRoomsControls } from "./_components/MyRoomsControls";

export const metadata = { title: "My Rooms — WinCup" };

type MaybePromise<T> = T | Promise<T>;

interface MyRoomsPageProps {
  searchParams?: MaybePromise<MyRoomSearchParams>;
}

export default async function MyRoomsPage({ searchParams }: MyRoomsPageProps) {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?redirectTo=/my-rooms");

  const filters = parseMyRoomFilters(searchParams ? await searchParams : {});
  const admin = createAdminClient() as unknown as SupabaseRoomReader;
  const sessionDb = supabase as unknown as SupabaseRoomReader;

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

  const roomMap = new Map<string, RoomListItem>();
  for (const room of hostedResult.data ?? []) {
    roomMap.set(room.id, toRoomListItem(room, "host"));
  }
  for (const room of joinedResult.data ?? []) {
    if (!roomMap.has(room.id)) {
      roomMap.set(
        room.id,
        toRoomListItem(room, room.host_user_id === user.id ? "host" : "player")
      );
    }
  }

  const myRooms = await withRoomCounts(admin, [...roomMap.values()]);
  const filteredRooms = filterMyRooms(myRooms, filters);
  const hostedCount = myRooms.filter((room) => room.userRole === "host").length;
  const joinedCount = myRooms.filter((room) => room.userRole === "player").length;
  const activeCount = myRooms.filter((room) => room.status !== "finished").length;
  const hasFilters = hasMyRoomFilters(filters);
  const userLabel = profile?.username ?? user.email ?? "player";

  return (
    <AppShell userLabel={userLabel}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:py-8">
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-gold">
                My Rooms
              </p>
              <h1 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">
                Rooms you host or joined
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted">
                Search by room name or code, then filter by hosted, joined, active, or finished.
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
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-2xl border border-gold/40 px-4 py-3 text-sm font-bold text-gold transition-colors hover:bg-gold/10"
              >
                Discover
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/8 bg-surface p-3">
              <p className="text-xs text-muted">Hosted</p>
              <p className="mt-1 text-xl font-black text-white">{hostedCount}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-surface p-3">
              <p className="text-xs text-muted">Joined</p>
              <p className="mt-1 text-xl font-black text-white">{joinedCount}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-surface p-3">
              <p className="text-xs text-muted">Active</p>
              <p className="mt-1 text-xl font-black text-white">{activeCount}</p>
            </div>
          </div>

          <MyRoomsControls filters={filters} />
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted">
              Results ({filteredRooms.length})
            </h2>
            {hasFilters && (
              <Link href="/my-rooms" className="text-sm font-semibold text-gold hover:underline">
                Clear filters
              </Link>
            )}
          </div>

          {filteredRooms.length > 0 ? (
            <div className="flex flex-col gap-3">
              {filteredRooms.map((room) => (
                <RoomCard key={room.id} room={room} />
              ))}
            </div>
          ) : (
            <RoomEmptyState
              icon={hasFilters ? "🔎" : "🏟️"}
              title={hasFilters ? "No rooms match those filters" : "No rooms yet"}
              message={
                hasFilters
                  ? "Clear filters or try another room code, role, status, or sort."
                  : "Create your first room, join by code, or discover a public room waiting for players."
              }
              primaryHref={hasFilters ? "/my-rooms" : "/room/create"}
              primaryLabel={hasFilters ? "Clear filters" : "Create Room"}
              secondaryHref={hasFilters ? undefined : "/dashboard"}
              secondaryLabel={hasFilters ? undefined : "Discover Public Rooms"}
            />
          )}
        </section>
      </div>
    </AppShell>
  );
}
