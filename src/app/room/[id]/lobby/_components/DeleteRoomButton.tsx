"use client";

import { useActionState, useState } from "react";
import { deleteRoom, type DeleteRoomState } from "@/actions/room";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface DeleteRoomButtonProps {
  roomId: string;
  roomName?: string | null;
}

export function DeleteRoomButton({ roomId, roomName }: DeleteRoomButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [state, formAction, isPending] = useActionState<DeleteRoomState, FormData>(
    deleteRoom,
    null
  );

  if (!isConfirming) {
    return (
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        className="text-xs font-semibold text-muted underline-offset-4 transition-colors hover:text-danger hover:underline"
        data-testid="open-delete-room-confirmation"
      >
        Delete waiting room
      </button>
    );
  }

  return (
    <div
      role="alert"
      className="rounded-2xl border border-danger/35 bg-danger/10 p-4 text-left"
      data-testid="delete-room-confirmation"
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold text-danger">Delete this waiting room?</p>
        <p className="text-xs leading-relaxed text-muted">
          This permanently removes {roomName ? `"${roomName}"` : "this room"}, its room code,
          joined players, and selected countries. You can only do this before the room starts.
        </p>

        {state?.error && (
          <p className="text-xs font-semibold text-danger" data-testid="delete-room-error">
            {state.error}
          </p>
        )}

        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <form action={formAction} className="flex-1">
            <input type="hidden" name="roomId" value={roomId} />
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-danger/60 px-4 py-2.5 text-sm font-bold text-danger transition-colors hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="confirm-delete-room"
            >
              {isPending ? (
                <>
                  <LoadingSpinner size="sm" color="white" />
                  Deleting…
                </>
              ) : (
                "Yes, delete room"
              )}
            </button>
          </form>

          <button
            type="button"
            disabled={isPending}
            onClick={() => setIsConfirming(false)}
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
