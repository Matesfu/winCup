"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormSection } from "@/components/ui/FormSection";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { createRoom, type CreateRoomState } from "@/actions/room";
import { HostNameInput } from "./HostNameInput";
import { WinRuleToggle } from "./WinRuleToggle";
import { CountryGrid } from "./CountryGrid";
import { StakeInput } from "./StakeInput";
import { ALLOWED_AVATARS } from "@/lib/constants";
import type { WinRule, Country } from "@/lib/types/database";

interface CreateRoomFormProps {
  countries: Pick<Country, "code" | "name" | "flag_emoji">[];
  defaultHostName?: string;
}

export function CreateRoomForm({ countries, defaultHostName = "" }: CreateRoomFormProps) {
  const [state, formAction, isPending] = useActionState<CreateRoomState, FormData>(
    createRoom,
    null
  );

  // Local form state — synced into hidden inputs before submission
  const [hostName, setHostName] = useState(defaultHostName);
  const [avatar, setAvatar] = useState<string>(ALLOWED_AVATARS[0]);
  const [winRule, setWinRule] = useState<WinRule>("last_standing");
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [stakeAmount, setStakeAmount] = useState("");
  // Whether the host is participating as a player in the draw (default: yes)
  const [hostIsPlaying, setHostIsPlaying] = useState(true);

  function toggleCountry(code: string) {
    setSelectedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  const canSubmit = selectedCountries.size >= 4 && hostName.trim().length > 0;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* Hidden inputs carry state that is controlled outside native form inputs */}
      <input type="hidden" name="hostName" value={hostName} />
      <input type="hidden" name="avatarEmoji" value={avatar} />
      <input type="hidden" name="winRule" value={winRule} />
      <input type="hidden" name="stakeAmount" value={stakeAmount} />
      <input type="hidden" name="hostIsPlaying" value={hostIsPlaying ? "true" : "false"} />
      {Array.from(selectedCountries).map((code) => (
        <input key={code} type="hidden" name="countries" value={code} />
      ))}

      {/* Global form error */}
      {state?.errors?.form && (
        <div
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {state.errors.form}
        </div>
      )}

      {/* Section 1 — Host info */}
      <FormSection
        title="1. Your Info"
        description="Choose a display name for this game."
      >
        <HostNameInput
          name={hostName}
          onNameChange={setHostName}
          avatar={avatar}
          onAvatarChange={setAvatar}
          nameError={state?.errors?.hostName}
          disabled={isPending}
        />

        {/* Are you playing? toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={hostIsPlaying}
          disabled={isPending}
          onClick={() => setHostIsPlaying((v) => !v)}
          className={[
            "flex w-full items-center justify-between rounded-xl border px-4 py-3 transition-all duration-200",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            hostIsPlaying
              ? "border-gold/40 bg-gold/5"
              : "border-white/8 bg-surface",
            isPending ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="flex flex-col items-start gap-0.5 text-left">
            <span className="text-sm font-medium text-white">
              I&apos;m playing in this room
            </span>
            <span className="text-xs text-muted">
              {hostIsPlaying
                ? "You'll be in the draw and need a country."
                : "You'll manage the room but won't receive a country."}
            </span>
          </div>
          {/* Visual toggle pill */}
          <div
            className={[
              "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
              hostIsPlaying ? "bg-gold" : "bg-white/20",
            ].join(" ")}
          >
            <div
              className={[
                "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
                hostIsPlaying ? "translate-x-5" : "translate-x-0.5",
              ].join(" ")}
            />
          </div>
        </button>
      </FormSection>

      {/* Section 2 — Win rule */}
      <FormSection
        title="2. Win Rule"
        description="How is the winner decided at the end?"
      >
        <WinRuleToggle value={winRule} onChange={setWinRule} disabled={isPending} />
      </FormSection>

      {/* Section 3 — Country selection */}
      <FormSection
        title="3. Pick Countries"
        description="Select the countries that will be in the draw. You need at least 4."
      >
        <CountryGrid
          countries={countries}
          selected={selectedCountries}
          onToggle={toggleCountry}
          error={state?.errors?.countries}
          disabled={isPending}
        />
      </FormSection>

      {/* Section 4 — Optional stake */}
      <FormSection
        title="4. Stake (Optional)"
        description="Set a display amount for the pot. WinCup does not process payments."
      >
        <StakeInput
          value={stakeAmount}
          onChange={setStakeAmount}
          error={state?.errors?.stakeAmount}
          disabled={isPending}
        />
      </FormSection>

      {/* Submit */}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        disabled={!canSubmit || isPending}
        data-testid="create-room-submit"
      >
        {isPending ? (
          <span className="flex items-center gap-2">
            <LoadingSpinner size="sm" color="white" />
            Creating room…
          </span>
        ) : (
          "Create Room"
        )}
      </Button>

      {!canSubmit && !isPending && (
        <p className="text-center text-xs text-muted">
          {hostName.trim().length === 0
            ? "Enter a display name to continue."
            : "Select at least 4 countries to continue."}
        </p>
      )}
    </form>
  );
}
