"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Input } from "@/components/ui/Input";
import { joinRoom, type JoinRoomState } from "@/actions/room";
import { EmojiPicker } from "@/app/room/create/_components/EmojiPicker";
import { ALLOWED_AVATARS } from "@/lib/constants";

interface JoinRoomFormProps {
  roomId: string;
  defaultName?: string;
}

export function JoinRoomForm({ roomId, defaultName = "" }: JoinRoomFormProps) {
  const [state, formAction, isPending] = useActionState<JoinRoomState, FormData>(
    joinRoom,
    null
  );

  const [playerName, setPlayerName] = useState(defaultName);
  const [avatar, setAvatar] = useState<string>(ALLOWED_AVATARS[0]);

  const canSubmit = playerName.trim().length > 0;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {/* Hidden inputs */}
      <input type="hidden" name="roomId" value={roomId} />
      <input type="hidden" name="playerName" value={playerName} />
      <input type="hidden" name="avatarEmoji" value={avatar} />

      {/* Global form error */}
      {state?.errors?.form && (
        <div
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {state.errors.form}
        </div>
      )}

      {/* Name + avatar preview row */}
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-gold bg-gold/10 text-3xl">
          {avatar}
        </div>
        <div className="flex-1">
          <Input
            label="Your display name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="How others will see you"
            maxLength={40}
            showCount
            error={state?.errors?.playerName}
            disabled={isPending}
            autoComplete="nickname"
          />
        </div>
      </div>

      {/* Avatar picker */}
      <div>
        <p className="mb-2 text-sm font-medium text-white">Pick an avatar</p>
        <EmojiPicker value={avatar} onChange={setAvatar} disabled={isPending} />
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        disabled={!canSubmit || isPending}
        data-testid="join-room-submit"
      >
        {isPending ? (
          <span className="flex items-center gap-2">
            <LoadingSpinner size="sm" color="white" />
            Joining…
          </span>
        ) : (
          "Join Room"
        )}
      </Button>
    </form>
  );
}
