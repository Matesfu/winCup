"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Input } from "@/components/ui/Input";
import { joinRoom, type JoinRoomState } from "@/actions/room";
import { EmojiPicker } from "@/app/room/create/_components/EmojiPicker";
import { ALLOWED_AVATARS } from "@/lib/constants";
import type { AssignmentMode } from "@/lib/types/database";

interface JoinCountryOption {
  code: string;
  name: string;
  flag_emoji: string;
  is_knocked_out: boolean;
  is_taken: boolean;
}

interface JoinRoomFormProps {
  roomId: string;
  defaultName?: string;
  assignmentMode: AssignmentMode;
  countries: JoinCountryOption[];
}

export function JoinRoomForm({
  roomId,
  defaultName = "",
  assignmentMode,
  countries,
}: JoinRoomFormProps) {
  const [state, formAction, isPending] = useActionState<JoinRoomState, FormData>(
    joinRoom,
    null
  );

  const [playerName, setPlayerName] = useState(defaultName);
  const [avatar, setAvatar] = useState<string>(ALLOWED_AVATARS[0]);
  const [countryCode, setCountryCode] = useState("");

  const needsCountry = assignmentMode === "player_choice";
  const canSubmit = playerName.trim().length > 0 && (!needsCountry || countryCode.length > 0);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {/* Hidden inputs */}
      <input type="hidden" name="roomId" value={roomId} />
      <input type="hidden" name="playerName" value={playerName} />
      <input type="hidden" name="avatarEmoji" value={avatar} />
      <input type="hidden" name="countryCode" value={countryCode} />

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

      {needsCountry && (
        <div className="flex flex-col gap-2">
          <label htmlFor="countryCode" className="text-sm font-medium text-white">
            Choose your country
          </label>
          <select
            id="countryCode"
            value={countryCode}
            onChange={(event) => setCountryCode(event.target.value)}
            disabled={isPending}
            className="h-11 rounded-xl border border-white/10 bg-surface px-3 text-sm font-semibold text-white outline-none transition-colors focus:border-gold focus:ring-1 focus:ring-gold disabled:opacity-50"
          >
            <option value="">Select an available country</option>
            {countries.map((country) => {
              const unavailable = country.is_knocked_out || country.is_taken;
              return (
                <option key={country.code} value={country.code} disabled={unavailable}>
                  {country.flag_emoji} {country.name}
                  {country.is_taken ? " (taken)" : country.is_knocked_out ? " (out)" : ""}
                </option>
              );
            })}
          </select>
          {state?.errors?.countryCode && (
            <p className="text-xs text-danger">{state.errors.countryCode}</p>
          )}
        </div>
      )}

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
