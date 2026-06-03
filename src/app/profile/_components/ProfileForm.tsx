"use client";

import { useActionState } from "react";
import { updateProfile, type UpdateProfileState } from "@/actions/profile";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface ProfileFormProps {
  username: string;
}

export function ProfileForm({ username }: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState<UpdateProfileState, FormData>(
    updateProfile,
    null
  );

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-3xl border border-white/8 bg-surface p-4">
      <div>
        <h2 className="text-lg font-extrabold text-white">Profile</h2>
        <p className="mt-1 text-sm text-muted">
          Update the username people see in rooms.
        </p>
      </div>

      <Input
        label="Username"
        name="username"
        defaultValue={username}
        maxLength={30}
        autoComplete="username"
        error={state?.errors?.username}
        helperText="Letters, numbers, and underscores only."
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
            Saving…
          </span>
        ) : (
          "Save Profile"
        )}
      </Button>
    </form>
  );
}
