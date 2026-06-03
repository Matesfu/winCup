import { redirect } from "next/navigation";
import Link from "next/link";
import { createSessionClient } from "@/lib/supabase/server";
import { PageBackdrop } from "@/components/ui/PageBackdrop";
import { SignUpForm } from "./_components/SignUpForm";

interface SignUpPageProps {
  searchParams: Promise<{ redirectTo?: string }>;
}

export const metadata = {
  title: "Create Account — WinCup",
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  // Redirect already-authenticated users
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { redirectTo } = await searchParams;

  if (user) redirect(redirectTo ?? "/dashboard");

  return (
    <main className="relative flex min-h-screen flex-1 flex-col items-center justify-center px-4 py-16">
      <PageBackdrop imageSrc="/world_cup1.jpg" />
      <Link
        href="/"
        className="absolute left-4 top-4 z-10 inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-surface px-4 py-2 text-sm font-bold text-white transition-colors hover:border-gold/50 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 sm:left-6 sm:top-6"
        aria-label="Go back to home"
      >
        <span aria-hidden="true">←</span>
        Back
      </Link>
      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-3 text-5xl">🏆</div>
          <h1 className="text-2xl font-extrabold text-white">
            Create your WinCup account
          </h1>
          <p className="mt-2 text-sm text-muted">
            Host rooms, pick countries, win with friends.
          </p>
        </div>

        <SignUpForm redirectTo={redirectTo} />
      </div>
    </main>
  );
}
