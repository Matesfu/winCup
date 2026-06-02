import { redirect, notFound } from "next/navigation";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { LadderRealtime } from "./_components/LadderRealtime";
import type { RoomPublic, RoomTeam, Match, Player } from "@/lib/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: "Knockout Bracket — WinCup",
};

export default async function LadderPage({ params }: PageProps) {
  const { id: roomId } = await params;
  const supabase = await createSessionClient();

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/sign-in?redirectTo=/room/${roomId}/ladder`);

  // Admin client for room-specific protected tables (room_teams, matches, players).
  // Their RLS policies require member membership, causing empty results in server
  // renders right after a phase transition. Admin client bypasses RLS reliably.
  const admin = createAdminClient();

  // Parallel fetches
  const [roomResult, roomTeamsResult, matchesResult, countriesResult, playersResult] =
    await Promise.all([
      (supabase as any)
        .from("rooms")
        .select("id,code,status,host_user_id,win_rule,stake_amount")
        .eq("id", roomId)
        .maybeSingle() as Promise<{
          data: Pick<RoomPublic, "id" | "code" | "status" | "host_user_id" | "win_rule" | "stake_amount"> | null;
        }>,
      (admin as any)
        .from("room_teams")
        .select("id,room_id,country_code,player_id,bracket_position,current_stage,is_eliminated")
        .eq("room_id", roomId)
        .order("bracket_position") as Promise<{ data: RoomTeam[] | null }>,
      (admin as any)
        .from("matches")
        .select("id,room_id,external_match_id,stage,team_a_code,team_b_code,winner_code,bracket_position,match_order")
        .eq("room_id", roomId) as Promise<{ data: Match[] | null }>,
      (supabase as any)
        .from("countries")
        .select("code,name,flag_emoji") as Promise<{
          data: { code: string; name: string; flag_emoji: string }[] | null;
        }>,
      (admin as any)
        .from("players")
        .select("id,name,avatar_emoji,user_id")
        .eq("room_id", roomId) as Promise<{
          data: Pick<Player, "id" | "name" | "avatar_emoji" | "user_id">[] | null;
        }>,
    ]);

  const room = roomResult.data;
  if (!room) notFound();

  // Status routing
  if (room.status === "group_stage") redirect(`/room/${roomId}/group-stage`);
  if (room.status === "lobby") redirect(`/room/${roomId}/lobby`);
  if (room.status === "drawn") redirect(`/room/${roomId}/draw`);
  if (room.status === "finished") redirect(`/room/${roomId}/winner`);
  // 'knockout' → stay here

  // If bracket hasn't been set up yet, host goes to bracket-setup; others wait
  const roomTeamsPreCheck = roomTeamsResult.data ?? [];
  if (roomTeamsPreCheck.length === 0) {
    if (user.id === room.host_user_id) {
      redirect(`/room/${roomId}/bracket-setup`);
    }
    // Non-host: show a waiting page (handled below by passing empty roomTeams)
  }

  const roomTeams = roomTeamsResult.data ?? [];
  const matches = matchesResult.data ?? [];
  const countries = countriesResult.data ?? [];
  const players = playersResult.data ?? [];
  const isHost = user.id === room.host_user_id;

  const countriesMap = new Map(countries.map((c) => [c.code, c]));
  // Build playersMap keyed by player ID
  const playersMap = new Map(
    players.map((p) => [
      p.id,
      { id: p.id, name: p.name, avatar_emoji: p.avatar_emoji },
    ])
  );
  // Also build user-ID lookup to detect current user's player
  const currentUserPlayer = players.find((p) => p.user_id === user.id);
  const currentUserId = currentUserPlayer?.id ?? user.id;

  return (
    <LadderRealtime
      roomId={roomId}
      initialRoom={room}
      initialRoomTeams={roomTeams}
      initialMatches={matches}
      countriesMap={countriesMap}
      playersMap={playersMap}
      isHost={isHost}
      currentUserId={currentUserId}
    />
  );
}
