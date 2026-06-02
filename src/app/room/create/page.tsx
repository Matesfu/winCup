import { redirect } from "next/navigation";
import Link from "next/link";
import { createSessionClient } from "@/lib/supabase/server";
import { CreateRoomForm } from "./_components/CreateRoomForm";
import type { Profile, Country } from "@/lib/types/database";

export const metadata = {
  title: "Create Room — WinCup",
};

export default async function CreateRoomPage() {
  // Auth guard — redirect unauthenticated users to sign-in
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/sign-in?redirectTo=/room/create");

  // Fetch username from profiles (best-effort — falls back to empty string)
  // Cast needed: @supabase/postgrest-js 2.106.x + TS5.9 generic regression
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle() as { data: Pick<Profile, "username"> | null };

  // Fetch all countries — public read, no auth required
  const { data: countries } = await (supabase as any)
    .from("countries")
    .select("code, name, flag_emoji, is_knocked_out")
    .order("name") as {
      data: Pick<Country, "code" | "name" | "flag_emoji" | "is_knocked_out">[] | null;
    };

  return (
    <main className="flex flex-1 flex-col items-center py-10 px-4">
      <div className="w-full max-w-2xl">
        {/* Back link */}
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-white"
        >
          ← Back
        </Link>

        <h1 className="mb-8 text-3xl font-extrabold text-white">
          Create a Room
        </h1>

        <CreateRoomForm
          countries={countries ?? []}
          defaultHostName={profile?.username ?? ""}
        />
      </div>
    </main>
  );
}
