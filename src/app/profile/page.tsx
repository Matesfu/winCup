import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { createSessionClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";
import { PasswordForm } from "./_components/PasswordForm";
import { ProfileForm } from "./_components/ProfileForm";
import { WalletPreviewCard } from "./_components/WalletPreviewCard";

export const metadata = { title: "Profile — WinCup" };

interface SupabaseQuery<TResult> extends PromiseLike<TResult> {
  select(columns: string): SupabaseQuery<TResult>;
  eq(column: string, value: string): SupabaseQuery<TResult>;
  maybeSingle(): Promise<TResult>;
}

interface SupabaseReader {
  from<TResult>(table: string): SupabaseQuery<TResult>;
}

function formatAccountDate(date: string | undefined) {
  if (!date) return "Unknown";
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export default async function ProfilePage() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?redirectTo=/profile");

  const db = supabase as unknown as SupabaseReader;
  const { data: profile } = await db
    .from<{ data: Pick<Profile, "username" | "created_at"> | null }>("profiles")
    .select("username,created_at")
    .eq("id", user.id)
    .maybeSingle();

  const username = profile?.username ?? "";
  const userLabel = username || user.email || "player";

  return (
    <AppShell userLabel={userLabel}>
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:py-8">
        <section>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-gold">
            Profile
          </p>
          <h1 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">
            Account settings
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Manage your public username, password, and future wallet settings.
          </p>
        </section>

        <section className="rounded-3xl border border-white/8 bg-surface/70 p-4">
          <h2 className="text-lg font-extrabold text-white">Account</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-background/60 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Username</p>
              <p className="mt-1 truncate text-sm font-semibold text-white">
                {username || "Not set"}
              </p>
            </div>
            <div className="rounded-2xl bg-background/60 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Email</p>
              <p className="mt-1 truncate text-sm font-semibold text-white">
                {user.email ?? "Not available"}
              </p>
            </div>
            <div className="rounded-2xl bg-background/60 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Joined</p>
              <p className="mt-1 truncate text-sm font-semibold text-white">
                {formatAccountDate(profile?.created_at ?? user.created_at)}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <ProfileForm username={username} />
          <PasswordForm />
        </div>

        <WalletPreviewCard />
      </div>
    </AppShell>
  );
}
