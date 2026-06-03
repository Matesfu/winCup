import { redirect, notFound, RedirectType } from "next/navigation";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { DrawOrchestrator } from "./_components/DrawOrchestrator";
import type { RoomPublic, Player } from "@/lib/types/database";

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

export const metadata = {
  title: "The Draw — WinCup",
};

export default async function DrawPage({ params }: PageProps) {
  const { id: roomId } = await params;
  const supabase = await createSessionClient();

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/sign-in?redirectTo=/room/${roomId}/draw`);

  // Use admin client for players: the RLS policy `players_read_room_members`
  // does a self-referential subquery that can fail in the server-component
  // render cycle immediately after `startDraw` redirects all clients here.
  // The admin client bypasses RLS and reliably returns the assigned players,
  // consistent with the fix applied to the lobby and join pages.
  // countries is publicly readable, so session client is fine there.
  const admin = createAdminClient();
  const sessionDb = supabase as unknown as SupabaseReader;
  const adminDb = admin as unknown as SupabaseReader;

  // Parallel fetches for initial render
  const [roomResult, playersResult, countriesResult] = await Promise.all([
    sessionDb
      .from<{
        data: Pick<
          RoomPublic,
          "id" | "code" | "status" | "win_rule" | "stake_amount"
        > | null;
      }>("rooms")
      .select("id,code,status,win_rule,stake_amount")
      .eq("id", roomId)
      .maybeSingle(),
    adminDb
      .from<{
        data: Pick<
          Player,
          "id" | "name" | "avatar_emoji" | "assigned_country" | "user_id"
        >[] | null;
      }>("players")
      .select("id,name,avatar_emoji,assigned_country,user_id")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true }),
    sessionDb
      .from<{
        data: { code: string; name: string; flag_emoji: string }[] | null;
      }>("countries")
      .select("code,name,flag_emoji"),
  ]);

  const room = roomResult.data;
  if (!room) notFound();

  // Status guard: redirect to the correct phase
  if (room.status === "lobby") redirect(`/room/${roomId}/lobby`, RedirectType.replace);
  if (room.status === "group_stage") redirect(`/room/${roomId}/group-stage`, RedirectType.replace);
  if (room.status === "knockout") redirect(`/room/${roomId}/ladder`, RedirectType.replace);
  if (room.status === "finished") redirect(`/room/${roomId}/winner`, RedirectType.replace);
  // status === 'drawn' → stay here

  const players = playersResult.data ?? [];
  const countries = countriesResult.data ?? [];

  // Check whether all players have been assigned a country.
  // With the admin client this is always accurate — no RLS timing gap.
  const allAssigned =
    players.length > 0 && players.every((p) => p.assigned_country !== null);

  return (
    <DrawOrchestrator
      roomId={roomId}
      players={players}
      countries={countries}
      allAssigned={allAssigned}
    />
  );
}
