import { redirect, notFound } from "next/navigation";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { WinnerScreen } from "./_components/WinnerScreen";
import { NoWinnerScreen } from "./_components/NoWinnerScreen";
import type { RoomPublic, Player, RoomTeam, Country } from "@/lib/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface SupabaseQuery<TResult> extends PromiseLike<TResult> {
  select(columns: string): SupabaseQuery<TResult>;
  eq(column: string, value: string): SupabaseQuery<TResult>;
  maybeSingle(): Promise<TResult>;
}

interface SupabaseReader {
  from<TResult>(table: string): SupabaseQuery<TResult>;
}

export const metadata = {
  title: "Winner — WinCup",
};

export default async function WinnerPage({ params }: PageProps) {
  const { id: roomId } = await params;
  const supabase = await createSessionClient();

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/sign-in?redirectTo=/room/${roomId}/winner`);

  const admin = createAdminClient();
  const sessionDb = supabase as unknown as SupabaseReader;
  const adminDb = admin as unknown as SupabaseReader;

  // Parallel fetches — admin client for member-only RLS tables
  const [roomResult, champTeamResult] = await Promise.all([
    sessionDb
      .from<{
        data: Pick<
          RoomPublic,
          "id" | "code" | "status" | "host_user_id" | "win_rule" | "stake_amount" | "winner_player_id"
        > | null;
      }>("rooms")
      .select("id,code,status,host_user_id,win_rule,stake_amount,winner_player_id")
      .eq("id", roomId)
      .maybeSingle(),
    // Champion team — to show "which country actually won" for no-winner screen
    adminDb
      .from<{
        data: Pick<RoomTeam, "country_code" | "player_id"> | null;
      }>("room_teams")
      .select("country_code, player_id")
      .eq("room_id", roomId)
      .eq("current_stage", "champion")
      .maybeSingle(),
  ]);

  const room = roomResult.data;
  if (!room) notFound();

  // Status routing — only 'finished' rooms belong on this page
  if (room.status === "knockout") redirect(`/room/${roomId}/ladder`);
  if (room.status === "group_stage") redirect(`/room/${roomId}/group-stage`);
  if (room.status === "drawn") redirect(`/room/${roomId}/draw`);
  if (room.status === "lobby") redirect(`/room/${roomId}/lobby`);
  // 'finished' → stay here

  const champTeam = champTeamResult.data;

  // Fetch winner player (if any) and country info in parallel
  const [winnerPlayerResult, champCountryResult] = await Promise.all([
    room.winner_player_id
      ? adminDb
          .from<{
            data: Pick<Player, "id" | "name" | "avatar_emoji" | "assigned_country"> | null;
          }>("players")
          .select("id,name,avatar_emoji,assigned_country")
          .eq("id", room.winner_player_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    champTeam?.country_code
      ? sessionDb
          .from<{
            data: Pick<Country, "code" | "name" | "flag_emoji"> | null;
          }>("countries")
          .select("code,name,flag_emoji")
          .eq("code", champTeam.country_code)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const winnerPlayer = winnerPlayerResult.data;
  const champCountry = champCountryResult.data;

  // Fetch winner's country separately when winner exists
  let winnerCountry: Pick<Country, "code" | "name" | "flag_emoji"> | null = null;
  if (winnerPlayer?.assigned_country) {
    const { data: wc } = await sessionDb
      .from<{
        data: Pick<Country, "code" | "name" | "flag_emoji"> | null;
      }>("countries")
      .select("code,name,flag_emoji")
      .eq("code", winnerPlayer.assigned_country)
      .maybeSingle();
    winnerCountry = wc;
  }

  const hasWinner = room.winner_player_id !== null && winnerPlayer !== null;

  if (hasWinner && winnerPlayer && winnerCountry) {
    return (
      <WinnerScreen
        playerName={winnerPlayer.name}
        playerAvatar={winnerPlayer.avatar_emoji}
        countryName={winnerCountry.name}
        countryFlag={winnerCountry.flag_emoji}
        stakeAmount={room.stake_amount}
        winMessage={
          room.win_rule === "strict"
            ? "Champion's owner wins the pot! 🏆"
            : "Last team standing wins! 🏆"
        }
      />
    );
  }

  // No winner (strict mode with filler champion, or edge case)
  return (
    <NoWinnerScreen
      championCountryName={champCountry?.name ?? "The champion"}
      championCountryFlag={champCountry?.flag_emoji ?? "🏆"}
      stakeAmount={room.stake_amount}
    />
  );
}
