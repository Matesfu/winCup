import Link from "next/link";
import { createSessionClient } from "@/lib/supabase/server";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/Button";
import { PageBackdrop } from "@/components/ui/PageBackdrop";

interface SupabaseQuery<TResult> extends PromiseLike<TResult> {
  select(columns: string): SupabaseQuery<TResult>;
  eq(column: string, value: string): SupabaseQuery<TResult>;
  maybeSingle(): Promise<TResult>;
}

interface SupabaseReader {
  from<TResult>(table: string): SupabaseQuery<TResult>;
}

export default async function LandingPage() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let username: string | null = null;
  if (user) {
    const db = supabase as unknown as SupabaseReader;
    const { data: profile } = await db
      .from<{ data: { username: string } | null }>("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();
    username = profile?.username ?? null;
  }

  return (
    <main className="relative min-h-screen bg-background">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[100svh] overflow-hidden">
        <PageBackdrop imageSrc="/world_cup1.jpg" fit="viewport" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <nav className="sticky top-0 z-30 border-b border-white/5 bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-extrabold text-gold">
              <span aria-hidden="true">🏆</span>
              <span>WinCup</span>
            </Link>
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <span className="hidden text-xs text-muted sm:block">
                    Hi, <span className="font-medium text-white">{username ?? "player"}</span>
                  </span>
                  <Button href="/dashboard" variant="primary" size="sm">
                    Dashboard
                  </Button>
                </>
              ) : (
                <>
                  <Button href="/auth/sign-in" variant="ghost" size="sm">
                    Sign In
                  </Button>
                  <Button href="/auth/sign-up" variant="outline" size="sm">
                    Sign Up
                  </Button>
                </>
              )}
            </div>
          </div>
        </nav>

        <section className="relative flex min-h-[80svh] flex-col items-center justify-center px-6 py-20 text-center">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div className="h-[500px] w-[500px] rounded-full bg-gold/5 blur-[120px]" />
          </div>

          <div className="animate-slide-up relative z-10">
            <div className="mb-4 text-7xl" aria-hidden="true">
              🏆
            </div>
            <h1 className="mb-4 text-5xl font-extrabold tracking-tight text-gold sm:text-6xl md:text-7xl">
              WinCup
            </h1>
            <p className="mx-auto mb-10 max-w-xl text-lg text-muted sm:text-xl">
              Pick a country. Follow the cup.{" "}
              <span className="font-medium text-white">One winner takes it all.</span>
            </p>

            {user ? (
              <div className="flex flex-col items-center gap-4">
                <Button href="/dashboard" size="lg" variant="primary">
                  My Dashboard →
                </Button>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Button href="/room/create" size="md" variant="outline">
                    + Create New Room
                  </Button>
                  <Button href="/room/join" size="md" variant="ghost">
                    Join a Room
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
                  <Button href="/auth/sign-up" size="lg" variant="primary">
                    Get Started Free
                  </Button>
                  <Button href="/auth/sign-in" size="lg" variant="outline">
                    Sign In
                  </Button>
                </div>
                <p className="text-xs text-muted">
                  Already know a room code?{" "}
                  <Link href="/room/join" className="text-gold hover:underline">
                    Join directly →
                  </Link>
                </p>
              </div>
            )}
          </div>
        </section>

        <div className="relative min-h-[100svh] overflow-hidden">
          <PageBackdrop imageSrc="/world-cup-2.jpg" fit="viewport" />
          <div className="relative z-10">
            <HowItWorks />
            <Footer />
          </div>
        </div>
      </div>
    </main>
  );
}
