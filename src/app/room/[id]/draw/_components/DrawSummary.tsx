"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { startGroupStage, type GroupStageState } from "@/actions/room";
import type { Player } from "@/lib/types/database";

interface CountryInfo {
  code: string;
  name: string;
  flag_emoji: string;
}

type DrawPlayer = Pick<Player, "id" | "name" | "avatar_emoji" | "assigned_country">;

interface DrawSummaryProps {
  roomId: string;
  players: DrawPlayer[];
  countriesMap: Map<string, CountryInfo>;
}

export function DrawSummary({ roomId, players, countriesMap }: DrawSummaryProps) {
  const [state, formAction, isPending] = useActionState<GroupStageState, FormData>(
    startGroupStage,
    null
  );

  return (
    <div className="flex flex-col items-center gap-8 px-4 py-10 animate-slide-up">
      {/* Header */}
      <div className="text-center">
        <div className="mb-3 text-5xl" aria-hidden="true">🏆</div>
        <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
          The Draw is Complete!
        </h2>
        <p className="mt-2 text-sm text-muted">
          Every player has their country. May the best team win.
        </p>
      </div>

      {/* Results grid */}
      <div
        className="grid w-full max-w-2xl gap-3 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="draw-summary-grid"
      >
        {players.map((player) => {
          const country = player.assigned_country
            ? countriesMap.get(player.assigned_country)
            : null;

          return (
            <div
              key={player.id}
              data-testid="summary-player-card"
              className="flex flex-col items-center gap-2 rounded-2xl border border-white/8 bg-surface p-4 text-center"
            >
              <span className="text-3xl" aria-hidden="true">
                {player.avatar_emoji ?? "👤"}
              </span>
              <span className="text-sm font-semibold text-white">{player.name}</span>
              <div className="h-px w-full bg-white/10" />
              {country ? (
                <>
                  <span
                    className="text-4xl"
                    aria-label={country.name}
                    data-testid="summary-country-flag"
                  >
                    {country.flag_emoji}
                  </span>
                  <span className="text-sm font-bold text-gold" data-testid="summary-country-name">
                    {country.name}
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted">No country assigned</span>
              )}
            </div>
          );
        })}
      </div>

      <form action={formAction} className="w-full max-w-xs">
        <input type="hidden" name="roomId" value={roomId} />
        {state?.error && (
          <p className="mb-2 text-center text-xs text-danger">{state.error}</p>
        )}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          disabled={isPending}
          data-testid="go-to-group-stage"
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <LoadingSpinner size="sm" color="white" />
              Starting…
            </span>
          ) : (
            "Go to Group Stage →"
          )}
        </Button>
      </form>

    </div>
  );
}
