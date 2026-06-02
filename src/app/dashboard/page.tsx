import { redirect } from "next/navigation";
import Link from "next/link";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import type { RoomPublic, Player } from "@/lib/types/database";

export const metadata = { title: "Dashboard — WinCup" };

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  lobby: "Lobby",
  drawn: "Draw",
  group_stage: "Group Stage",
  knockout: "Knockout",
  finished: "Finished",
};

const STATUS_COLOR: Record<string, string> = {
  lobby:       "bg-white/10 text-muted",
  drawn:       "bg-blue-500/15 text-blue-300",
  group_stage: "bg-amber-500/15 text-amber-300",
  knockout:    "bg-orange-500/15 text-orange-300",
  finished:    "bg-success/15 text-success",
};

function roomRoute(room: { id: string; status: string }): string {
  switch (room.status) {
    case "lobby":       return `/room/${room.id}/lobby`;
    case "drawn":       return `/room/${room.id}/draw`;
    case "group_stage": return `/room/${room.id}/group-stage`;
    case "knockout":    return `/room/${room.id}/ladder`;
    case "finished":    return `/room/${room.id}/winner`;
    default:            return `/room/${room.id}/lobby`;
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?redirectTo=/dashboard");

  const admin = createAdminClient();

  // Fetch user profile
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle() as { data: { username: string } | null };

  // 1. Rooms the user joined as player
  const { data: playerRows } = await (admin as any)
    .from("players")
    .select("room_id")
    .eq("user_id", user.id) as { data: { room_id: string }[] | null };

  const joinedRoomIds = (playerRows ?? []).map(p => p.room_id);

  // 2. All room IDs (joined + hosted)
  const allRoomIds = [...new Set([...joinedRoomIds])];

  // 3. Fetch full room data + hosted rooms (user may be host without being a player)
  let rooms: (Pick<RoomPublic, "id" | "code" | "status" | "host_user_id" | "host_name" | "win_rule" | "stake_amount" | "created_at"> & {
    playerCount: number;
    countryCount: number;
    userRole: "host" | "player";
    winnerPlayerId: string | null;
  })[] = [];

  if (allRoomIds.length > 0 || true) {
    // Fetch rooms where user is host OR player
    const [joinedResult, hostedResult] = await Promise.all([
      allRoomIds.length > 0
        ? (admin as any)
            .from("rooms")
            .select("id,code,status,host_user_id,host_name,win_rule,stake_amount,created_at,winner_player_id")
            .in("id", allRoomIds)
            .order("created_at", { ascending: false }) as Promise<{
              data: (Pick<RoomPublic, "id" | "code" | "status" | "host_user_id" | "host_name" | "win_rule" | "stake_amount" | "created_at"> & { winner_player_id: string | null })[] | null;
            }>
        : Promise.resolve({ data: [] as any }),
      (admin as any)
        .from("rooms")
        .select("id,code,status,host_user_id,host_name,win_rule,stake_amount,created_at,winner_player_id")
        .eq("host_user_id", user.id)
        .order("created_at", { ascending: false }) as Promise<{
          data: (Pick<RoomPublic, "id" | "code" | "status" | "host_user_id" | "host_name" | "win_rule" | "stake_amount" | "created_at"> & { winner_player_id: string | null })[] | null;
        }>,
    ]);

    // Merge, dedup by id
    const roomMap = new Map<string, typeof rooms[number]>();
    const all = [...(hostedResult.data ?? []), ...(joinedResult.data ?? [])];
    for (const r of all) {
      if (!roomMap.has(r.id)) {
        roomMap.set(r.id, {
          ...r,
          playerCount: 0,
          countryCount: 0,
          userRole: r.host_user_id === user.id ? "host" : "player",
          winnerPlayerId: r.winner_player_id,
        });
      }
    }

    // Fetch player/country counts in parallel
    const ids = [...roomMap.keys()];

    const noData = Promise.resolve({ data: [] as { room_id: string }[] });

    const [playerCounts, countryCounts] = await Promise.all([
      ids.length
        ? ((admin as any).from("players").select("room_id").in("room_id", ids) as Promise<{ data: { room_id: string }[] | null }>)
        : noData,
      ids.length
        ? ((admin as any).from("room_countries").select("room_id").in("room_id", ids) as Promise<{ data: { room_id: string }[] | null }>)
        : noData,
    ]);

    const pCounts = new Map<string, number>();
    for (const p of playerCounts.data ?? []) {
      pCounts.set(p.room_id, (pCounts.get(p.room_id) ?? 0) + 1);
    }
    const cCounts = new Map<string, number>();
    for (const c of countryCounts.data ?? []) {
      cCounts.set(c.room_id, (cCounts.get(c.room_id) ?? 0) + 1);
    }

    for (const [id, room] of roomMap) {
      room.playerCount = pCounts.get(id) ?? 0;
      room.countryCount = cCounts.get(id) ?? 0;
    }

    rooms = [...roomMap.values()].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  const activeRooms = rooms.filter(r => r.status !== "finished");
  const finishedRooms = rooms.filter(r => r.status === "finished");

  return (
    <main className="min-h-screen bg-background">
      {/* Top nav */}
      <nav className="sticky top-0 z-30 border-b border-white/5 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-extrabold text-gold">
            <span aria-hidden="true">🏆</span>
            <span>WinCup</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted sm:block">
              <span className="text-white font-medium">{profile?.username ?? user.email}</span>
            </span>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-4xl px-4 py-8 flex flex-col gap-8">

        {/* Welcome */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
              Welcome back, <span className="text-gold">{profile?.username ?? "player"}</span> 👋
            </h1>
            <p className="mt-1 text-sm text-muted">
              {rooms.length === 0
                ? "You're not in any rooms yet."
                : `You're in ${rooms.length} room${rooms.length !== 1 ? "s" : ""}.`}
            </p>
          </div>
          <div className="flex gap-2 mt-3 sm:mt-0">
            <Button href="/room/create" variant="primary" size="sm">
              + Create Room
            </Button>
            <Button href="/room/join" variant="outline" size="sm">
              Join Room
            </Button>
          </div>
        </div>

        {/* Active rooms */}
        {activeRooms.length > 0 && (
          <section>
            <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted">
              Active Rooms ({activeRooms.length})
            </h2>
            <div className="flex flex-col gap-3">
              {activeRooms.map(room => (
                <RoomCard key={room.id} room={room} isCurrentUser={room.host_user_id === user.id} />
              ))}
            </div>
          </section>
        )}

        {/* Finished rooms */}
        {finishedRooms.length > 0 && (
          <section>
            <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted">
              Completed Rooms ({finishedRooms.length})
            </h2>
            <div className="flex flex-col gap-3">
              {finishedRooms.map(room => (
                <RoomCard key={room.id} room={room} isCurrentUser={room.host_user_id === user.id} />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {rooms.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="text-6xl" aria-hidden="true">🏟️</div>
            <h2 className="text-xl font-bold text-white">No rooms yet</h2>
            <p className="max-w-sm text-sm text-muted">
              Create a room and invite friends, or join an existing room with a code.
            </p>
            <div className="flex gap-3">
              <Button href="/room/create" variant="primary">
                Create Room
              </Button>
              <Button href="/room/join" variant="outline">
                Join Room
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// ── Room card sub-component ───────────────────────────────────────────────────

function RoomCard({
  room,
  isCurrentUser,
}: {
  room: {
    id: string;
    code: string;
    status: string;
    host_name: string;
    host_user_id: string;
    win_rule: string;
    stake_amount: number | null;
    userRole: "host" | "player";
    playerCount: number;
    countryCount: number;
    winnerPlayerId: string | null;
  };
  isCurrentUser: boolean;
}) {
  const statusLabel = STATUS_LABEL[room.status] ?? room.status;
  const statusColor = STATUS_COLOR[room.status] ?? "bg-white/10 text-muted";
  const route = roomRoute(room);

  return (
    <div className="group relative flex flex-col gap-3 rounded-2xl border border-white/8 bg-surface p-4 transition-all hover:border-gold/30 sm:flex-row sm:items-center sm:gap-4">
      {/* Left: code + meta */}
      <div className="flex flex-1 flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-lg font-extrabold text-gold tracking-wider">
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
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
          <span>👤 {room.host_name}&apos;s room</span>
          <span>👥 {room.playerCount}/{room.countryCount} players</span>
          <span>{room.win_rule === "strict" ? "🏆 Must Win" : "⚔️ Last Standing"}</span>
          {room.stake_amount !== null && <span>💰 £{room.stake_amount}</span>}
        </div>

        {room.status === "finished" && room.winnerPlayerId && (
          <p className="text-xs text-success">✓ Game complete</p>
        )}
        {room.status === "finished" && !room.winnerPlayerId && (
          <p className="text-xs text-muted">Stakes returned</p>
        )}
      </div>

      {/* Right: CTA */}
      <div className="shrink-0">
        <Link
          href={route}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gold/40 bg-gold/5 px-4 py-2 text-sm font-semibold text-gold transition-all hover:bg-gold/15 hover:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          {room.status === "finished" ? "View Results" : "Enter Room"}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
