import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
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
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
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
