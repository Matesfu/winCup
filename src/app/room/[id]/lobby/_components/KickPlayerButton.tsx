"use client";

import { useActionState } from "react";
import { kickPlayer, type KickPlayerState } from "@/actions/room";

interface KickPlayerButtonProps {
  roomId: string;
  playerId: string;
  playerName: string;
}

export function KickPlayerButton({ roomId, playerId, playerName }: KickPlayerButtonProps) {
  const [state, formAction, isPending] = useActionState<KickPlayerState, FormData>(
    kickPlayer,
    null
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="roomId" value={roomId} />
      <input type="hidden" name="playerId" value={playerId} />
      <button
        type="submit"
        disabled={isPending}
        aria-label={`Remove ${playerName} from room`}
        data-testid={`kick-${playerId}`}
        title={state?.error ?? `Remove ${playerName}`}
        className={[
          "flex h-7 w-7 items-center justify-center rounded-lg",
          "border border-white/10 bg-surface text-muted",
          "transition-all duration-150 hover:border-danger/50 hover:bg-danger/10 hover:text-danger",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-danger",
          isPending ? "cursor-not-allowed opacity-40" : "cursor-pointer",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {isPending ? (
          /* spinner */
          <svg
            className="h-3.5 w-3.5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" strokeOpacity="0.3" />
            <path d="M21 12a9 9 0 0 0-9-9" />
          </svg>
        ) : (
          /* × icon */
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
          </svg>
        )}
      </button>
    </form>
  );
}
