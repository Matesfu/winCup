import { Badge } from "@/components/ui/Badge";
import type { Player } from "@/lib/types/database";

type CardState = "alive" | "eliminated" | "undecided";

interface CountryInfo {
  code: string;
  name: string;
  flag_emoji: string;
}

interface GroupStatusCardProps {
  player: Pick<Player, "id" | "name" | "avatar_emoji" | "assigned_country" | "is_eliminated">;
  country: CountryInfo | null;
  qualified: boolean | null;
  isCurrentUser: boolean;
}

function getCardState(qualified: boolean | null, isEliminated: boolean): CardState {
  if (qualified === false || isEliminated) return "eliminated";
  if (qualified === true) return "alive";
  return "undecided";
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
  isCurrentUser,
}: GroupStatusCardProps) {
  const state = getCardState(qualified, player.is_eliminated);

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
        </div>
      ) : (
        <span className="text-xs text-muted">—</span>
      )}

      {/* Status indicator */}
      {state === "alive" && (
        <Badge variant="success" data-testid="status-alive">✓ Qualified</Badge>
      )}
      {state === "eliminated" && (
        <Badge variant="danger" data-testid="status-eliminated">❌ Knocked Out</Badge>
      )}
      {state === "undecided" && (
        <span className="text-xs text-muted" data-testid="status-undecided">Pending…</span>
      )}
    </div>
  );
}
