"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { JoinCodeInput } from "@/components/ui/JoinCodeInput";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { lookupRoomByCode, type LookupRoomState } from "@/actions/room";

export default function JoinRoomPage() {
  const [code, setCode] = useState("");
  const [state, formAction, isPending] = useActionState<LookupRoomState, FormData>(
    lookupRoomByCode,
    null
  );

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-3 text-5xl">🏆</div>
          <h1 className="text-2xl font-extrabold text-white">Join a Room</h1>
          <p className="mt-2 text-sm text-muted">
            Enter the room code from your host.
          </p>
        </div>

        {/* Form */}
        <form action={formAction} className="flex flex-col items-center gap-6">
          <input type="hidden" name="code" value={code} />

          <JoinCodeInput
            value={code}
            onChange={setCode}
            error={state?.error}
            disabled={isPending}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            disabled={code.length < 7 || isPending} // WC-XXXX = 7 chars
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner size="sm" color="white" />
                Looking up…
              </span>
            ) : (
              "Continue →"
            )}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-muted">
          Don&apos;t have a code?{" "}
          <Link href="/room/create" className="font-medium text-gold hover:underline">
            Create a Room →
          </Link>
        </p>
      </div>
    </main>
  );
}
