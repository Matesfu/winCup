import { redirect, notFound } from "next/navigation";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { LobbyRealtime } from "./_components/LobbyRealtime";
import type { RoomPublic, Player } from "@/lib/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: "Lobby — WinCup",
};

export default async function LobbyPage({ params }: PageProps) {
  const { id: roomId } = await params;
  const supabase = await createSessionClient();

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/sign-in?redirectTo=/room/${roomId}/lobby`);

  // Use admin client for players + room_countries: their RLS policies only allow
  // members to read, which causes a timing issue right after createRoom redirects
  // here (the session context may not reflect the newly-inserted player row yet).
  // Admin client bypasses RLS reliably for this read-only display data.
  const admin = createAdminClient();

  // Parallel fetches for initial render (no waterfall)
  const [roomResult, playersResult, countriesResult] = await Promise.all([
    (supabase as any)
      .from("rooms")
      .select("id,code,status,host_user_id,host_name,win_rule,stake_amount,winner_player_id,created_at,external_competition_id,external_season_id")
      .eq("id", roomId)
      .maybeSingle() as Promise<{ data: RoomPublic | null }>,
    (admin as any)
      .from("players")
      .select("id,room_id,user_id,name,avatar_emoji,assigned_country,is_eliminated,joined_at")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true }) as Promise<{ data: Player[] | null }>,
    (admin as any)
      .from("room_countries")
      .select("country_code, countries:countries(code,name,flag_emoji)")
      .eq("room_id", roomId) as Promise<{
        data: { country_code: string; countries: { code: string; name: string; flag_emoji: string } }[] | null;
      }>,
  ]);

  const room = roomResult.data;
  if (!room) notFound();

  // If game moved past lobby, redirect to the appropriate phase page
  if (room.status === "drawn") redirect(`/room/${roomId}/draw`);
  if (room.status === "group_stage") redirect(`/room/${roomId}/group-stage`);
  if (room.status === "knockout") redirect(`/room/${roomId}/ladder`);
  if (room.status === "finished") redirect(`/room/${roomId}/winner`);

  const players = playersResult.data ?? [];
  const countries = countriesResult.data ?? [];
  const isHost = user.id === room.host_user_id;

  return (
    <LobbyRealtime
      roomId={roomId}
      initialRoom={room}
      initialPlayers={players}
      initialCountries={countries}
      currentUserId={user.id}
      isHost={isHost}
    />
  );
}
