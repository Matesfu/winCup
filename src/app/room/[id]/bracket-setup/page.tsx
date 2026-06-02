import { redirect, notFound } from "next/navigation";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { BracketSetupBoard } from "./_components/BracketSetupBoard";
import type { RoomPublic, Player } from "@/lib/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Bracket Setup — WinCup" };

export default async function BracketSetupPage({ params }: PageProps) {
  const { id: roomId } = await params;
  const supabase = await createSessionClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/sign-in?redirectTo=/room/${roomId}/bracket-setup`);

  const admin = createAdminClient();

  const [roomResult, allCountriesResult, playersResult] = await Promise.all([
    (supabase as any).from("rooms").select("id,code,status,host_user_id")
      .eq("id", roomId)
      .maybeSingle() as Promise<{ data: Pick<RoomPublic, "id" | "code" | "status" | "host_user_id"> | null }>,

    // Fetch ALL countries — host can place any team in the bracket, not just the draw pool
    (supabase as any)
      .from("countries")
      .select("code,name,flag_emoji")
      .order("name") as Promise<{ data: { code: string; name: string; flag_emoji: string }[] | null }>,

    // Room players — so we can mark player-owned teams with the player's name
    (admin as any)
      .from("players")
      .select("id,assigned_country,name,is_eliminated,user_id")
      .eq("room_id", roomId) as Promise<{ data: Pick<Player, "id" | "assigned_country" | "name" | "is_eliminated" | "user_id">[] | null }>,
  ]);

  const room = roomResult.data;
  if (!room) notFound();

  // Status routing
  if (room.status === "group_stage") redirect(`/room/${roomId}/group-stage`);
  if (room.status === "lobby") redirect(`/room/${roomId}/lobby`);
  if (room.status === "finished") redirect(`/room/${roomId}/winner`);

  // If bracket already set up, go to ladder
  const { data: existingTeams } = await (admin as any)
    .from("room_teams").select("id").eq("room_id", roomId).limit(1) as { data: { id: string }[] | null };
  if (existingTeams && existingTeams.length > 0) redirect(`/room/${roomId}/ladder`);

  const isHost = user.id === room.host_user_id;

  // Build lookup: countryCode → alive player name (only non-eliminated players)
  const playerByCountry = new Map(
    (playersResult.data ?? [])
      .filter(p => p.assigned_country && !p.is_eliminated)
      .map(p => [p.assigned_country!, p.name])
  );

  // All countries, tagged with player name if someone holds that country
  const allTeams = (allCountriesResult.data ?? []).map(c => ({
    code: c.code,
    name: c.name,
    flag_emoji: c.flag_emoji,
    player_name: playerByCountry.get(c.code) ?? null,
  }));

  // Pre-sort: player-owned teams first, then alphabetical
  allTeams.sort((a, b) => {
    if (a.player_name && !b.player_name) return -1;
    if (!a.player_name && b.player_name) return 1;
    return a.name.localeCompare(b.name);
  });

  const totalPlayers = (playersResult.data ?? []).length;

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8">
      <div className="w-full max-w-3xl flex flex-col gap-6">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
            Build Knockout Bracket
          </h1>
          {isHost ? (
            <>
              <p className="mt-2 text-sm text-muted">
                Pick any teams advancing from the group stage — player-owned or neutral — and pair them into matches.
              </p>
              <p className="mt-1 text-xs text-muted/60">
                🥇 <span className="text-gold">Gold name</span> = team owned by a player &nbsp;·&nbsp; No name = neutral team
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">
              Waiting for the host to set up the bracket…
            </p>
          )}
        </div>

        {isHost ? (
          <BracketSetupBoard
            roomId={roomId}
            allTeams={allTeams}
            totalPlayers={totalPlayers}
          />
        ) : (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="text-5xl animate-pulse">⚙️</div>
            <p className="text-muted text-sm animate-pulse">
              ⏳ Host is setting up the bracket — you'll be redirected automatically.
            </p>
            {/* eslint-disable-next-line @next/next/no-head-element */}
            <meta httpEquiv="refresh" content="5" />
          </div>
        )}
      </div>
    </main>
  );
}
