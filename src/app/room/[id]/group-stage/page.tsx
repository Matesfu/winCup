import { redirect, notFound, RedirectType } from "next/navigation";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { GroupStageRealtime } from "./_components/GroupStageRealtime";
import type { FifaStage } from "@/lib/fifa";
import type { RoomPublic, Player, RoomCountry, Country } from "@/lib/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface SupabaseQuery<TResult> extends PromiseLike<TResult> {
  select(columns: string): SupabaseQuery<TResult>;
  eq(column: string, value: string): SupabaseQuery<TResult>;
  order(column: string, options: { ascending: boolean }): SupabaseQuery<TResult>;
  maybeSingle(): Promise<TResult>;
}

interface SupabaseReader {
  from<TResult>(table: string): SupabaseQuery<TResult>;
}

type GroupStageRoom = Pick<
  RoomPublic,
  "id" | "code" | "status" | "fifa_stage" | "win_rule" | "stake_amount"
>;

type QueryError = {
  code?: string;
  message?: string;
};

function isMissingFifaStageError(error: QueryError | null | undefined) {
  return error?.code === "42703" || error?.message?.includes("fifa_stage");
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
  const sessionDb = supabase as unknown as SupabaseReader;
  const adminDb = admin as unknown as SupabaseReader;

  // Parallel fetches — admin client for member-only RLS tables
  const [initialRoomResult, playersResult, roomCountriesResult, countriesResult] =
    await Promise.all([
      sessionDb
        .from<{
          data: GroupStageRoom | null;
          error: QueryError | null;
        }>("rooms")
        .select("id,code,status,fifa_stage,win_rule,stake_amount")
        .eq("id", roomId)
        .maybeSingle(),
      adminDb
        .from<{
          data: Pick<Player, "id" | "name" | "avatar_emoji" | "assigned_country" | "is_eliminated" | "user_id">[] | null;
        }>("players")
        .select("id,name,avatar_emoji,assigned_country,is_eliminated,user_id")
        .eq("room_id", roomId)
        .order("joined_at", { ascending: true }),
      adminDb
        .from<{
          data: Pick<RoomCountry, "id" | "country_code" | "qualified">[] | null;
        }>("room_countries")
        .select("id,country_code,qualified")
        .eq("room_id", roomId),
      sessionDb
        .from<{
          data: Pick<Country, "code" | "name" | "flag_emoji" | "is_knocked_out">[] | null;
        }>("countries")
        .select("code,name,flag_emoji,is_knocked_out"),
    ]);

  let roomResult = initialRoomResult;

  if (!roomResult.data && isMissingFifaStageError(roomResult.error)) {
    const fallbackRoomResult = await sessionDb
      .from<{
        data: Omit<GroupStageRoom, "fifa_stage"> | null;
        error: QueryError | null;
      }>("rooms")
      .select("id,code,status,win_rule,stake_amount")
      .eq("id", roomId)
      .maybeSingle();

    roomResult = {
      data: fallbackRoomResult.data
        ? { ...fallbackRoomResult.data, fifa_stage: "First Stage" as FifaStage }
        : null,
      error: fallbackRoomResult.error,
    };
  }

  const room = roomResult.data;
  if (!room) notFound();

  // Status routing
  if (room.status === "lobby") redirect(`/room/${roomId}/lobby`, RedirectType.replace);
  if (room.status === "knockout") redirect(`/room/${roomId}/ladder`, RedirectType.replace);
  if (room.status === "finished") redirect(`/room/${roomId}/winner`, RedirectType.replace);
  // 'drawn' and 'group_stage' both render this page; no host setup step is required.

  const players = playersResult.data ?? [];
  const roomCountries = roomCountriesResult.data ?? [];
  const countries = countriesResult.data ?? [];

  return (
    <GroupStageRealtime
      roomId={roomId}
      initialRoom={room}
      initialPlayers={players}
      initialRoomCountries={roomCountries}
      initialCountries={countries}
      currentUserId={user.id}
    />
  );
}
