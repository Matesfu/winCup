"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { startDraw, type StartDrawState } from "@/actions/room";
import type { AssignmentMode } from "@/lib/types/database";

interface StartDrawButtonProps {
  roomId: string;
  isReady: boolean;
  assignmentMode: AssignmentMode;
  waitingMessage: string;
}

export function StartDrawButton({
  roomId,
  isReady,
  assignmentMode,
  waitingMessage,
}: StartDrawButtonProps) {
  const [state, formAction, isPending] = useActionState<StartDrawState, FormData>(
    startDraw,
    null
  );
  const isPlayerChoice = assignmentMode === "player_choice";

  return (
    <div className="flex w-full flex-col items-center gap-2">
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
            <>{isPlayerChoice ? "🚀 Start Room" : "🎲 Start Draw"}</>
          )}
        </Button>
      </form>

      {!isReady && !isPending && (
        <p className="text-xs text-muted text-center">
          {waitingMessage}
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
