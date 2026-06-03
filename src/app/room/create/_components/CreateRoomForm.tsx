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
import type { AssignmentMode, RoomVisibility, WinRule, Country } from "@/lib/types/database";

interface CreateRoomFormProps {
  countries: Pick<Country, "code" | "name" | "flag_emoji" | "is_knocked_out">[];
  defaultHostName?: string;
}

export function CreateRoomForm({ countries, defaultHostName = "" }: CreateRoomFormProps) {
  const [state, formAction, isPending] = useActionState<CreateRoomState, FormData>(
    createRoom,
    null
  );

  // Local form state — synced into hidden inputs before submission
  const [roomName, setRoomName] = useState(defaultHostName ? `${defaultHostName}'s room` : "");
  const [hostName, setHostName] = useState(defaultHostName);
  const [avatar, setAvatar] = useState<string>(ALLOWED_AVATARS[0]);
  const [winRule, setWinRule] = useState<WinRule>("last_standing");
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("random");
  const [visibility, setVisibility] = useState<RoomVisibility>("private");
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [hostCountryCode, setHostCountryCode] = useState("");
  const [stakeAmount, setStakeAmount] = useState("");
  // Whether the host is participating as a player in the draw (default: yes)
  const [hostIsPlaying, setHostIsPlaying] = useState(true);

  function toggleCountry(code: string) {
    const country = countries.find((candidate) => candidate.code === code);
    if (country?.is_knocked_out) return;

    const wasSelected = selectedCountries.has(code);
    setSelectedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
    if (wasSelected && hostCountryCode === code) setHostCountryCode("");
  }

  function selectAllAvailableCountries() {
    const availableCountryCodes = countries
      .filter((country) => !country.is_knocked_out)
      .map((country) => country.code);

    setSelectedCountries(new Set(availableCountryCodes));
  }

  function clearSelectedCountries() {
    setSelectedCountries(new Set());
    setHostCountryCode("");
  }

  const selectedCountryOptions = countries.filter(
    (country) => selectedCountries.has(country.code) && !country.is_knocked_out
  );
  const needsHostCountry = assignmentMode === "player_choice" && hostIsPlaying;
  const hasValidStake = stakeAmount.trim().length > 0 && Number(stakeAmount) > 0;
  const canSubmit =
    roomName.trim().length > 0 &&
    hostName.trim().length > 0 &&
    hasValidStake &&
    selectedCountries.size >= 2 &&
    (!needsHostCountry || hostCountryCode.length > 0);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* Hidden inputs carry state that is controlled outside native form inputs */}
      <input type="hidden" name="roomName" value={roomName} />
      <input type="hidden" name="hostName" value={hostName} />
      <input type="hidden" name="avatarEmoji" value={avatar} />
      <input type="hidden" name="winRule" value={winRule} />
      <input type="hidden" name="assignmentMode" value={assignmentMode} />
      <input type="hidden" name="visibility" value={visibility} />
      <input type="hidden" name="stakeAmount" value={stakeAmount} />
      <input type="hidden" name="hostIsPlaying" value={hostIsPlaying ? "true" : "false"} />
      <input type="hidden" name="hostCountryCode" value={hostCountryCode} />
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

      <FormSection
        title="1. Room Setup"
        description="Name the room and choose how players can find it."
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-white">Room name</span>
          <input
            value={roomName}
            onChange={(event) => setRoomName(event.target.value)}
            maxLength={60}
            placeholder="Friday night sweepstake"
            disabled={isPending}
            className="h-11 rounded-xl border border-white/10 bg-surface px-3 text-sm text-white placeholder:text-muted outline-none transition-colors focus:border-gold focus:ring-1 focus:ring-gold disabled:opacity-50"
          />
          {state?.errors?.roomName && (
            <span className="text-xs text-danger">{state.errors.roomName}</span>
          )}
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          {(["private", "public"] as const).map((option) => (
            <button
              key={option}
              type="button"
              disabled={isPending}
              onClick={() => setVisibility(option)}
              className={[
                "rounded-xl border px-4 py-3 text-left transition-colors",
                visibility === option
                  ? "border-gold/50 bg-gold/10"
                  : "border-white/8 bg-surface hover:border-white/20",
              ].join(" ")}
            >
              <span className="block text-sm font-bold text-white">
                {option === "private" ? "Private" : "Public"}
              </span>
              <span className="mt-1 block text-xs text-muted">
                {option === "private"
                  ? "Join by code or invite link only."
                  : "Visible in dashboard discovery while waiting."}
              </span>
            </button>
          ))}
        </div>
        {state?.errors?.visibility && (
          <p className="text-xs text-danger">{state.errors.visibility}</p>
        )}
      </FormSection>

      {/* Section 2 — Host info */}
      <FormSection
        title="2. Your Info"
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

      <FormSection
        title="3. Assignment Mode"
        description="Choose how countries are assigned to players."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {(["random", "player_choice"] as const).map((option) => (
            <button
              key={option}
              type="button"
              disabled={isPending}
              onClick={() => {
                setAssignmentMode(option);
                if (option === "random") setHostCountryCode("");
              }}
              className={[
                "rounded-xl border px-4 py-3 text-left transition-colors",
                assignmentMode === option
                  ? "border-gold/50 bg-gold/10"
                  : "border-white/8 bg-surface hover:border-white/20",
              ].join(" ")}
            >
              <span className="block text-sm font-bold text-white">
                {option === "random" ? "Random assignment" : "Player choice"}
              </span>
              <span className="mt-1 block text-xs text-muted">
                {option === "random"
                  ? "Players join, then WinCup randomly assigns countries."
                  : "Players choose an available country when joining."}
              </span>
            </button>
          ))}
        </div>
        {state?.errors?.assignmentMode && (
          <p className="text-xs text-danger">{state.errors.assignmentMode}</p>
        )}
      </FormSection>

      {/* Section 4 — Win rule */}
      <FormSection
        title="4. Win Rule"
        description="How is the winner decided at the end?"
      >
        <WinRuleToggle value={winRule} onChange={setWinRule} disabled={isPending} />
      </FormSection>

      {/* Section 5 — Country selection */}
      <FormSection
        title="5. Pick Countries"
        description="Select the countries available in this room. You need at least 2."
      >
        <CountryGrid
          countries={countries}
          selected={selectedCountries}
          onToggle={toggleCountry}
          onSelectAll={selectAllAvailableCountries}
          onClearAll={clearSelectedCountries}
          error={state?.errors?.countries}
          disabled={isPending}
          minimum={2}
        />
      </FormSection>

      {needsHostCountry && (
        <FormSection
          title="6. Your Country"
          description="Because you are playing, choose your country before creating the room."
        >
          <label htmlFor="hostCountryCode" className="text-sm font-medium text-white">
            Choose your country
          </label>
          <select
            id="hostCountryCode"
            value={hostCountryCode}
            onChange={(event) => setHostCountryCode(event.target.value)}
            disabled={isPending || selectedCountryOptions.length === 0}
            className="h-11 rounded-xl border border-white/10 bg-surface px-3 text-sm font-semibold text-white outline-none transition-colors focus:border-gold focus:ring-1 focus:ring-gold disabled:opacity-50"
          >
            <option value="">Choose your country</option>
            {selectedCountryOptions.map((country) => (
              <option key={country.code} value={country.code}>
                {country.flag_emoji} {country.name}
              </option>
            ))}
          </select>
          {state?.errors?.hostCountry && (
            <p className="text-xs text-danger">{state.errors.hostCountry}</p>
          )}
        </FormSection>
      )}

      {/* Section 7 — Required stake */}
      <FormSection
        title={needsHostCountry ? "7. Stake" : "6. Stake"}
        description="Set the stake amount players must see before joining this room."
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
            : roomName.trim().length === 0
              ? "Enter a room name to continue."
              : !hasValidStake
                ? "Enter a stake amount greater than 0 to continue."
                : needsHostCountry && hostCountryCode.length === 0
                  ? "Choose your country to continue."
                  : "Select at least 2 countries to continue."}
        </p>
      )}
    </form>
  );
}
