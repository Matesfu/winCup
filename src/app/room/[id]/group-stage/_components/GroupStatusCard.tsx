import { Badge } from "@/components/ui/Badge";
import { buildFifaFixturesUrl, type FifaStage } from "@/lib/fifa";
import type { Player } from "@/lib/types/database";

type CardState = "alive" | "eliminated" | "undecided";

interface CountryInfo {
  code: string;
  name: string;
  flag_emoji: string;
  is_knocked_out: boolean;
}

interface GroupStatusCardProps {
  player: Pick<Player, "id" | "name" | "avatar_emoji" | "assigned_country" | "is_eliminated">;
  country: CountryInfo | null;
  qualified: boolean | null;
  fifaStage: FifaStage;
  isCurrentUser: boolean;
}

function getCardState(
  qualified: boolean | null,
  isEliminated: boolean,
  isKnockedOut: boolean,
  hasCountry: boolean
): CardState {
  if (!hasCountry) return "undecided";
  if (qualified === false || isEliminated || isKnockedOut) return "eliminated";
  return "alive";
}

const stateStyles: Record<CardState, string> = {
  alive: "border-success/60 bg-success/5",
  eliminated: "border-danger/40 bg-danger/5 opacity-60",
  undecided: "border-white/8 bg-surface",
};

export function GroupStatusCard({
  player,
  country,
  qualified,
  fifaStage,
  isCurrentUser,
}: GroupStatusCardProps) {
  const state = getCardState(
    qualified,
    player.is_eliminated,
    country?.is_knocked_out ?? false,
    Boolean(country)
  );
  const fifaFixturesUrl = country
    ? buildFifaFixturesUrl({
        stage: country.is_knocked_out ? "none" : fifaStage,
        country,
      })
    : null;

  return (
    <div
      data-testid="group-status-card"
      data-state={state}
      className={[
        "flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all duration-300",
        stateStyles[state],
        isCurrentUser ? "ring-1 ring-gold/40" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Avatar */}
      <span className="text-3xl" aria-hidden="true">
        {player.avatar_emoji ?? "👤"}
      </span>

      {/* Player name */}
      <span className="text-sm font-semibold text-white">
        {player.name}
        {isCurrentUser && (
          <span className="ml-1 text-xs font-normal text-muted">(you)</span>
        )}
      </span>

      {/* Country */}
      {country ? (
        <div className="flex flex-col items-center gap-1">
          <span
            className={`text-3xl transition-all duration-300 ${state === "eliminated" ? "grayscale" : ""}`}
            aria-label={country.name}
            data-testid="status-card-flag"
          >
            {country.flag_emoji}
          </span>
          <span className="text-xs text-muted">{country.name}</span>
          {country.is_knocked_out && (
            <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-danger">
              Out of cup
            </span>
          )}
        </div>
      ) : (
        <span className="text-xs text-muted">—</span>
      )}

      {/* Status indicator */}
      {state === "alive" && (
        <Badge variant="success" data-testid="status-alive">✓ Still in Cup</Badge>
      )}
      {state === "eliminated" && (
        <Badge variant="danger" data-testid="status-eliminated">❌ Knocked Out</Badge>
      )}
      {state === "undecided" && (
        <span className="text-xs text-muted" data-testid="status-undecided">Pending…</span>
      )}

      {fifaFixturesUrl && (
        <a
          href={fifaFixturesUrl}
          target="_blank"
          rel="noreferrer"
          data-testid="match-result-link"
          aria-label={`Open ${country?.name} matches and results on FIFA`}
          className="mt-1 inline-flex w-full items-center justify-center rounded-lg border border-gold/40 px-3 py-2 text-xs font-bold text-gold transition-colors hover:bg-gold/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          Match and result
        </a>
      )}
    </div>
  );
}
