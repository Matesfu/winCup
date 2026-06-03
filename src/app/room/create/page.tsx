import { redirect } from "next/navigation";
import Link from "next/link";
import { createSessionClient } from "@/lib/supabase/server";
import { CreateRoomForm } from "./_components/CreateRoomForm";
import type { Profile, Country } from "@/lib/types/database";

export const metadata = {
  title: "Create Room — WinCup",
};

interface SupabaseQuery<TResult> extends PromiseLike<TResult> {
  select(columns: string): SupabaseQuery<TResult>;
  eq(column: string, value: string | boolean): SupabaseQuery<TResult>;
  order(column: string): SupabaseQuery<TResult>;
  maybeSingle(): Promise<TResult>;
}

interface SupabaseReader {
  from<TResult>(table: string): SupabaseQuery<TResult>;
}

export default async function CreateRoomPage() {
  // Auth guard — redirect unauthenticated users to sign-in
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/sign-in?redirectTo=/room/create");
  const db = supabase as unknown as SupabaseReader;

  // Fetch username from profiles (best-effort — falls back to empty string)
  const { data: profile } = await db
    .from<{ data: Pick<Profile, "username"> | null }>("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  // Fetch selectable countries only — knocked-out countries are hidden from room creation
  const { data: countries } = await db
    .from<{
      data: Pick<Country, "code" | "name" | "flag_emoji" | "is_knocked_out">[] | null;
    }>("countries")
    .select("code, name, flag_emoji, is_knocked_out")
    .eq("is_knocked_out", false)
    .order("name");

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
