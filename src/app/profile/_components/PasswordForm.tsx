"use client";

import { useActionState } from "react";
import { updatePassword, type UpdatePasswordState } from "@/actions/profile";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PasswordInput } from "@/components/ui/PasswordInput";

export function PasswordForm() {
  const [state, formAction, isPending] = useActionState<UpdatePasswordState, FormData>(
    updatePassword,
    null
  );

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-3xl border border-white/8 bg-surface p-4">
      <div>
        <h2 className="text-lg font-extrabold text-white">Password</h2>
        <p className="mt-1 text-sm text-muted">
          Choose a new password with at least 8 characters.
        </p>
      </div>

      <PasswordInput
        label="New password"
        name="password"
        autoComplete="new-password"
        error={state?.errors?.password}
        disabled={isPending}
      />

      {state?.errors?.form && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {state.errors.form}
        </p>
      )}
      {state?.success && (
        <p role="status" className="text-sm font-semibold text-success">
          {state.success}
        </p>
      )}

      <Button type="submit" variant="primary" size="sm" disabled={isPending}>
        {isPending ? (
          <span className="flex items-center gap-2">
            <LoadingSpinner size="sm" color="white" />
            Updating…
          </span>
        ) : (
          "Update Password"
        )}
      </Button>
    </form>
  );
}
