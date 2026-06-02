import { redirect, notFound } from "next/navigation";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { GroupStageRealtime } from "./_components/GroupStageRealtime";
import type { RoomPublic, Player, RoomCountry, Country } from "@/lib/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: "Group Stage — WinCup",
};

export default async function GroupStagePage({ params }: PageProps) {
  const { id: roomId } = await params;
  const supabase = await createSessionClient();

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/sign-in?redirectTo=/room/${roomId}/group-stage`);

  const admin = createAdminClient();

  // Parallel fetches — admin client for member-only RLS tables
  const [roomResult, playersResult, roomCountriesResult, countriesResult] =
    await Promise.all([
      (supabase as any)
        .from("rooms")
        .select("id,code,status,host_user_id,win_rule,stake_amount")
        .eq("id", roomId)
        .maybeSingle() as Promise<{
          data: Pick<RoomPublic, "id" | "code" | "status" | "host_user_id" | "win_rule" | "stake_amount"> | null;
        }>,
      (admin as any)
        .from("players")
        .select("id,name,avatar_emoji,assigned_country,is_eliminated,user_id")
        .eq("room_id", roomId)
        .order("joined_at", { ascending: true }) as Promise<{
          data: Pick<Player, "id" | "name" | "avatar_emoji" | "assigned_country" | "is_eliminated" | "user_id">[] | null;
        }>,
      (admin as any)
        .from("room_countries")
        .select("id,country_code,qualified")
        .eq("room_id", roomId) as Promise<{
          data: Pick<RoomCountry, "id" | "country_code" | "qualified">[] | null;
        }>,
      (supabase as any)
        .from("countries")
        .select("code,name,flag_emoji") as Promise<{
          data: Pick<Country, "code" | "name" | "flag_emoji">[] | null;
        }>,
    ]);

  const room = roomResult.data;
  if (!room) notFound();

  // Status routing
  if (room.status === "lobby") redirect(`/room/${roomId}/lobby`);
  if (room.status === "knockout") redirect(`/room/${roomId}/ladder`);
  if (room.status === "finished") redirect(`/room/${roomId}/winner`);
  // 'drawn' and 'group_stage' both render this page (drawn shows waiting state for non-host)

  const players = playersResult.data ?? [];
  const roomCountries = roomCountriesResult.data ?? [];
  const countries = countriesResult.data ?? [];
  const isHost = user.id === room.host_user_id;

  const countriesMap = new Map(countries.map((c) => [c.code, c]));

  return (
    <GroupStageRealtime
      roomId={roomId}
      initialRoom={room}
      initialPlayers={players}
      initialRoomCountries={roomCountries}
      countriesMap={countriesMap}
      isHost={isHost}
      currentUserId={user.id}
    />
  );
}
