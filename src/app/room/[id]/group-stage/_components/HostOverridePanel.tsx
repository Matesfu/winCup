"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { markQualification, buildKnockout, type MarkQualState, type BuildKnockoutState } from "@/actions/room";

interface CountryInfo {
  code: string;
  name: string;
  flag_emoji: string;
}

interface CountryOverride {
  country_code: string;
  qualified: boolean | null;
}

interface HostOverridePanelProps {
  roomId: string;
  roomCountries: CountryOverride[];
  countriesMap: Map<string, CountryInfo>;
  allDecided: boolean;
}

export function HostOverridePanel({
  roomId,
  roomCountries,
  countriesMap,
  allDecided,
}: HostOverridePanelProps) {
  const [qualState, qualFormAction, qualPending] = useActionState<MarkQualState, FormData>(
    markQualification,
    null
  );
  const [buildState, buildFormAction, buildPending] = useActionState<BuildKnockoutState, FormData>(
    buildKnockout,
    null
  );

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-surface/50 p-4">
      <h3 className="text-sm font-semibold text-white">
        Host Override{" "}
        <span className="font-normal text-muted">— mark each country&apos;s outcome</span>
      </h3>

      {qualState?.error && (
        <p role="alert" className="text-xs text-danger">{qualState.error}</p>
      )}

      {/* One row per country */}
      <div className="flex flex-col gap-2">
        {roomCountries.map((rc) => {
          const country = countriesMap.get(rc.country_code);
          if (!country) return null;

          return (
            <div
              key={rc.country_code}
              data-testid={`override-row-${rc.country_code}`}
              className="flex items-center gap-3 rounded-xl border border-white/5 bg-background/40 px-3 py-2"
            >
              {/* Flag + name */}
              <span className="text-xl" aria-hidden="true">{country.flag_emoji}</span>
              <span className="flex-1 text-sm text-white truncate">{country.name}</span>

              {/* Qualified button */}
              <form action={qualFormAction}>
                <input type="hidden" name="roomId" value={roomId} />
                <input type="hidden" name="countryCode" value={rc.country_code} />
                <input type="hidden" name="qualified" value="true" />
                <button
                  type="submit"
                  disabled={qualPending}
                  data-testid={`qualify-${rc.country_code}`}
                  className={[
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    rc.qualified === true
                      ? "bg-success/20 text-success border border-success/40"
                      : "bg-surface border border-white/10 text-muted hover:border-success/40 hover:text-success",
                    qualPending ? "cursor-not-allowed opacity-50" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {rc.qualified === true ? "✓ Qualified" : "Qualified"}
                </button>
              </form>

              {/* Knocked Out button */}
              <form action={qualFormAction}>
                <input type="hidden" name="roomId" value={roomId} />
                <input type="hidden" name="countryCode" value={rc.country_code} />
                <input type="hidden" name="qualified" value="false" />
                <button
                  type="submit"
                  disabled={qualPending}
                  data-testid={`knockedout-${rc.country_code}`}
                  className={[
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    rc.qualified === false
                      ? "bg-danger/20 text-danger border border-danger/40"
                      : "bg-surface border border-white/10 text-muted hover:border-danger/40 hover:text-danger",
                    qualPending ? "cursor-not-allowed opacity-50" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {rc.qualified === false ? "❌ Knocked Out" : "Knocked Out"}
                </button>
              </form>
            </div>
          );
        })}
      </div>

      {/* Build Knockout Bracket CTA */}
      <div className="mt-2 flex flex-col gap-2">
        {buildState?.error && (
          <p role="alert" className="text-xs text-danger">{buildState.error}</p>
        )}
        <form action={buildFormAction}>
          <input type="hidden" name="roomId" value={roomId} />
          <Button
            type="submit"
            variant="primary"
            size="md"
            fullWidth
            disabled={!allDecided || buildPending}
            data-testid="build-knockout-button"
          >
            {buildPending ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner size="sm" color="white" />
                Building…
              </span>
            ) : (
              "Build Knockout Bracket →"
            )}
          </Button>
        </form>
        {!allDecided && (
          <p className="text-center text-xs text-muted">
            Mark all countries before building the bracket.
          </p>
        )}
      </div>
    </div>
  );
}
