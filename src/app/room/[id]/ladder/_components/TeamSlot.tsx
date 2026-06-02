import type { BracketSlot } from "@/lib/bracket";

interface CountryInfo {
  code: string;
  name: string;
  flag_emoji: string;
}

interface PlayerInfo {
  id: string;
  name: string;
  avatar_emoji: string | null;
}

interface TeamSlotProps {
  slot: BracketSlot;
  country: CountryInfo | null;
  player: PlayerInfo | null;
  isWinner: boolean;
  isCurrentUser: boolean;
}

export function TeamSlot({ slot, country, player, isWinner, isCurrentUser }: TeamSlotProps) {
  // TBD slot
  if (slot.teamCode === null) {
    return (
      <div
        data-testid="team-slot-tbd"
        className="flex items-center gap-2 rounded-lg border border-dashed border-white/15 px-3 py-2 opacity-50"
      >
        <span className="text-xs text-muted">TBD</span>
      </div>
    );
  }

  // Champion
  if (slot.isChampion) {
    return (
      <div
        data-testid="team-slot-champion"
        className={[
          "flex items-center gap-2 rounded-lg border border-gold bg-gold/15 px-3 py-2",
          isCurrentUser ? "ring-1 ring-gold/60" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className="text-xl" aria-hidden="true">🏆</span>
        {country && (
          <span className="text-sm" aria-hidden="true">{country.flag_emoji}</span>
        )}
        <div className="flex flex-col min-w-0">
          {player && (
            <span className="text-xs font-bold text-gold truncate">{player.name}</span>
          )}
          {country && (
            <span className="text-xs text-white truncate">{country.name}</span>
          )}
        </div>
      </div>
    );
  }

  // Eliminated team
  if (slot.isEliminated) {
    return (
      <div
        data-testid="team-slot-eliminated"
        data-state="eliminated"
        className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 opacity-50"
      >
        {country && (
          <span className="text-sm grayscale" aria-hidden="true">{country.flag_emoji}</span>
        )}
        <div className="flex flex-col min-w-0">
          {player && (
            <span className="text-xs text-muted truncate">{player.name}</span>
          )}
          {country && (
            <span className="text-xs text-muted truncate">{country.name}</span>
          )}
        </div>
        <span className="ml-auto text-xs text-danger shrink-0">❌</span>
      </div>
    );
  }

  // Active team
  const isPlayerOwned = slot.playerId !== null;

  return (
    <div
      data-testid="team-slot-active"
      data-state={isWinner ? "winner" : "active"}
      className={[
        "flex items-center gap-2 rounded-lg border px-3 py-2 transition-all",
        isWinner
          ? "border-gold bg-gold/10 shadow-[0_0_8px_rgba(255,215,0,0.2)]"
          : isPlayerOwned
          ? "border-gold/30 bg-surface"
          : "border-white/10 bg-surface",
        isCurrentUser ? "ring-1 ring-gold/50" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {country && (
        <span className="text-sm shrink-0" aria-hidden="true">{country.flag_emoji}</span>
      )}
      <div className="flex flex-col min-w-0">
        {player && (
          <span className={`text-xs font-semibold truncate ${isWinner ? "text-gold" : "text-white"}`}>
            {player.name}
          </span>
        )}
        {country && (
          <span className={`text-xs truncate ${player ? "text-muted" : "text-white"}`}>
            {country.name}
          </span>
        )}
      </div>
      {isWinner && (
        <span className="ml-auto text-xs text-gold shrink-0">✓</span>
      )}
    </div>
  );
}
