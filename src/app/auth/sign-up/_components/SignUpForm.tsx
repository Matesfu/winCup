"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { signUp, type SignUpState } from "@/actions/auth";

interface SignUpFormProps {
  redirectTo?: string;
}

export function SignUpForm({ redirectTo }: SignUpFormProps) {
  const [state, formAction, isPending] = useActionState<SignUpState, FormData>(
    signUp,
    null
  );

  if (state?.message) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-surface/60 p-8 text-center">
        <div className="text-4xl">📧</div>
        <h2 className="text-xl font-bold text-white">Check your email</h2>
        <p className="text-sm leading-relaxed text-muted">{state.message}</p>
        <Link
          href={`/auth/sign-in${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`}
          className="text-sm text-gold hover:underline"
        >
          Go to Sign In →
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {/* Hidden field carries redirectTo through the form */}
      {redirectTo && (
        <input type="hidden" name="redirectTo" value={redirectTo} />
      )}

      {/* Global form error */}
      {state?.errors?.form && (
        <div
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {state.errors.form}
        </div>
      )}

      <Input
        label="Username"
        name="username"
        autoComplete="username"
        placeholder="e.g. golazo99"
        maxLength={30}
        error={state?.errors?.username}
        helperText="3–30 characters, letters, numbers, and underscores only"
        disabled={isPending}
      />

      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        error={state?.errors?.email}
        disabled={isPending}
      />

      <PasswordInput
        label="Password"
        name="password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        error={state?.errors?.password}
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
            Creating account…
          </span>
        ) : (
          "Create Account"
        )}
      </Button>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          href={`/auth/sign-in${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`}
          className="font-medium text-gold hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
