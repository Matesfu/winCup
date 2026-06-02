import { createSessionClient } from "@/lib/supabase/server";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

export default async function LandingPage() {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch profile for signed-in users
  let username: string | null = null;
  if (user) {
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle() as { data: { username: string } | null };
    username = profile?.username ?? null;
  }

  return (
    <main className="flex flex-1 flex-col">
      {/* Global nav bar */}
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
                  Hi, <span className="text-white font-medium">{username ?? "player"}</span>
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

      {/* Hero */}
      <section className="relative flex min-h-[80svh] flex-col items-center justify-center px-6 py-20 text-center">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[500px] w-[500px] rounded-full bg-gold/5 blur-[120px]" />
        </div>

        <div className="animate-slide-up relative z-10">
          <div className="mb-4 text-7xl" aria-hidden="true">🏆</div>
          <h1 className="mb-4 text-5xl font-extrabold tracking-tight text-gold sm:text-6xl md:text-7xl">
            WinCup
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-lg text-muted sm:text-xl">
            Pick a country. Follow the cup.{" "}
            <span className="text-white font-medium">One winner takes it all.</span>
          </p>

          {user ? (
            /* Authenticated CTA cluster */
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
            /* Unauthenticated CTA cluster */
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

      <HowItWorks />
      <Footer />
    </main>
  );
}
