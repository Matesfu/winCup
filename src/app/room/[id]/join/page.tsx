import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { CountryChip } from "@/components/ui/CountryChip";
import { Divider } from "@/components/ui/Divider";
import { JoinRoomForm } from "./_components/JoinRoomForm";
import { getPrivateRoomJoinCookieName } from "@/lib/private-room-access";
import type { AssignmentMode, RoomPublic, Player, Profile } from "@/lib/types/database";

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
  title: "Join Room — WinCup",
};

export default async function JoinRoomPage({ params }: PageProps) {
  const { id: roomId } = await params;
  const supabase = await createSessionClient();

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/sign-in?redirectTo=/room/${roomId}/join`);

  // Use the admin client for players + room_countries because the RLS policies
  // for those tables require the user to already be a member of the room.
  // A prospective joiner is not a member yet, so the session client would
  // return empty arrays — causing isFull = (0 >= 0) = true incorrectly.
  // The admin client bypasses RLS and returns the real data safely.
  const admin = createAdminClient();
  const sessionDb = supabase as unknown as SupabaseReader;
  const adminDb = admin as unknown as SupabaseReader;

  // Parallel fetches — room and profile use session client (their RLS allows it);
  // players and room_countries use admin client to bypass the member-only policies.
  const [roomResult, playersResult, countriesResult, profileResult] = await Promise.all([
    sessionDb
      .from<{
        data: Pick<
          RoomPublic,
          "id" | "code" | "status" | "host_user_id" | "host_name" | "room_name" | "visibility" | "win_rule" | "stake_amount" | "assignment_mode"
        > | null;
      }>("rooms")
      .select("id, code, status, host_user_id, host_name, room_name, visibility, win_rule, stake_amount, assignment_mode")
      .eq("id", roomId)
      .maybeSingle(),
    adminDb
      .from<{
        data: Pick<Player, "id" | "user_id" | "assigned_country">[] | null;
      }>("players")
      .select("id, user_id, assigned_country")
      .eq("room_id", roomId),
    adminDb
      .from<{
        data: {
          country_code: string;
          countries: { code: string; name: string; flag_emoji: string; is_knocked_out: boolean };
        }[] | null;
      }>("room_countries")
      .select("country_code, countries:countries(code,name,flag_emoji,is_knocked_out)")
      .eq("room_id", roomId),
    sessionDb
      .from<{ data: Pick<Profile, "username"> | null }>("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const room = roomResult.data;
  if (!room) notFound();

  // If game has already started, send to the lobby which will route further
  if (room.status !== "lobby") redirect(`/room/${roomId}/lobby`);

  const players = playersResult.data ?? [];
  const countries = countriesResult.data ?? [];
  const username = profileResult.data?.username ?? "";
  const assignmentMode = room.assignment_mode as AssignmentMode;
  const availableCountryCount = countries.filter(
    (country) => !country.countries.is_knocked_out
  ).length;
  const hasEnoughActiveCountries = availableCountryCount >= 2;
  const takenCountryCodes = new Set(
    players.map((player) => player.assigned_country).filter(Boolean)
  );

  // Already joined — redirect to lobby
  if (players.some((p) => p.user_id === user.id)) {
    redirect(`/room/${roomId}/lobby`);
  }

  if (room.visibility === "private" && room.host_user_id !== user.id) {
    const cookieStore = await cookies();
    const joinCookie = cookieStore.get(getPrivateRoomJoinCookieName(roomId));
    if (joinCookie?.value !== room.code) redirect("/room/join");
  }

  // Guard against 0-country edge case: room is only "full" when countries are
  // defined AND every slot is taken. Without this guard, 0 >= 0 = true would
  // incorrectly show "FULL" when room_countries couldn't be read.
  const isFull = availableCountryCount > 0 && players.length >= availableCountryCount;

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          href="/room/join"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-white"
        >
          ← Back
        </Link>

        <h1 className="mb-1 text-2xl font-extrabold text-white">
          Joining <span className="text-gold">{room.code}</span>
        </h1>

        {/* Room preview */}
        <div className="mb-6 rounded-2xl border border-white/8 bg-surface/60 p-4">
          <p className="text-sm font-medium text-white">
            {room.room_name}
          </p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span>
              {assignmentMode === "random" ? "Random assignment" : "Player choice"}
            </span>
            <span>
              {room.win_rule === "strict" ? "Must Win the Cup" : "Last Team Standing"}
            </span>
            {room.stake_amount !== null && <span>Stake: £{room.stake_amount}</span>}
            <span className={isFull ? "text-danger" : ""}>
              {players.length} / {availableCountryCount} players joined
              {isFull && " (FULL)"}
            </span>
          </div>
          {/* Country chips */}
          {countries.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {countries.map((rc) => (
                <CountryChip
                  key={rc.country_code}
                  code={rc.countries.code}
                  name={rc.countries.name}
                  flagEmoji={rc.countries.flag_emoji}
                  size="sm"
                />
              ))}
            </div>
          )}
        </div>

        {!hasEnoughActiveCountries ? (
          <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-4 text-center text-sm text-danger">
            This room no longer has at least 2 countries still in the cup.
          </div>
        ) : isFull ? (
          <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-4 text-center text-sm text-danger">
            This room is full. Ask your host to create a new one.
          </div>
        ) : (
          <>
            <Divider label="Your details" className="mb-5" />
            <JoinRoomForm
              roomId={roomId}
              defaultName={username}
              assignmentMode={assignmentMode}
              countries={countries.map((country) => ({
                code: country.countries.code,
                name: country.countries.name,
                flag_emoji: country.countries.flag_emoji,
                is_knocked_out: country.countries.is_knocked_out,
                is_taken: takenCountryCodes.has(country.country_code),
              }))}
            />
          </>
        )}
      </div>
    </main>
  );
}
