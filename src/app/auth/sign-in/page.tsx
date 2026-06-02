import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { SignInForm } from "./_components/SignInForm";

interface SignInPageProps {
  searchParams: Promise<{ redirectTo?: string }>;
}

export const metadata = {
  title: "Sign In — WinCup",
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
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
            Welcome back to WinCup
          </h1>
          <p className="mt-2 text-sm text-muted">
            Sign in with your username or email.
          </p>
        </div>

        <SignInForm redirectTo={redirectTo} />
      </div>
    </main>
  );
}
