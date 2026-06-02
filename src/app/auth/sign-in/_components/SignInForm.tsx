"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { signIn, type SignInState } from "@/actions/auth";

interface SignInFormProps {
  redirectTo?: string;
}

export function SignInForm({ redirectTo }: SignInFormProps) {
  const [state, formAction, isPending] = useActionState<SignInState, FormData>(
    signIn,
    null
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {redirectTo && (
        <input type="hidden" name="redirectTo" value={redirectTo} />
      )}

      {/* Global error banner */}
      {state?.error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {state.error}
        </div>
      )}

      <Input
        label="Username or email"
        name="identifier"
        autoComplete="username email"
        placeholder="username or you@example.com"
        disabled={isPending}
      />

      <PasswordInput
        label="Password"
        name="password"
        autoComplete="current-password"
        placeholder="Your password"
        disabled={isPending}
      />

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        disabled={isPending}
        className="mt-1"
      >
        {isPending ? (
          <span className="flex items-center gap-2">
            <LoadingSpinner size="sm" color="white" />
            Signing in…
          </span>
        ) : (
          "Sign In"
        )}
      </Button>

      <p className="text-center text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link
          href={`/auth/sign-up${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`}
          className="font-medium text-gold hover:underline"
        >
          Create one
        </Link>
      </p>
    </form>
  );
}
