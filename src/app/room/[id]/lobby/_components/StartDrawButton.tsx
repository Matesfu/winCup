"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { startDraw, type StartDrawState } from "@/actions/room";

interface StartDrawButtonProps {
  roomId: string;
  isReady: boolean;
}

export function StartDrawButton({ roomId, isReady }: StartDrawButtonProps) {
  const [state, formAction, isPending] = useActionState<StartDrawState, FormData>(
    startDraw,
    null
  );

  return (
    <div className="flex flex-col items-center gap-2">
      <form action={formAction} className="w-full">
        <input type="hidden" name="roomId" value={roomId} />
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          disabled={!isReady || isPending}
          data-testid="start-draw-button"
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <LoadingSpinner size="sm" color="white" />
              Starting…
            </span>
          ) : (
            <>🎲 Start Draw</>
          )}
        </Button>
      </form>

      {!isReady && !isPending && (
        <p className="text-xs text-muted text-center">
          Waiting for all players to join before the draw can start.
        </p>
      )}

      {state?.error && (
        <p role="alert" className="text-xs text-danger text-center">
          {state.error}
        </p>
      )}
    </div>
  );
}
