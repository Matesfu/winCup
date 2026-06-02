import { type ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import type { Player } from "@/lib/types/database";

interface PlayerCardProps {
  player: Player;
  isHost: boolean;
  isCurrentUser: boolean;
  animate?: boolean;
  country?: {
    name: string;
    flag_emoji: string;
    is_knocked_out?: boolean;
  };
  /** Optional kick button rendered on the right — provided by LobbyRealtime for the host */
  kickButton?: ReactNode;
}

export function PlayerCard({
  player,
  isHost,
  isCurrentUser,
  animate = false,
  country,
  kickButton,
}: PlayerCardProps) {
  return (
    <div
      data-testid="player-card"
      className={[
        "flex items-center gap-3 rounded-xl px-4 py-3",
        "border transition-all duration-200",
        isCurrentUser
          ? "border-gold/40 bg-gold/5"
          : "border-white/8 bg-surface",
        animate ? "animate-slide-up" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Avatar */}
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-2xl border border-white/10"
        aria-hidden="true"
      >
        {player.avatar_emoji ?? "👤"}
      </span>

      {/* Name + country */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">
          {player.name}
          {isCurrentUser && (
            <span className="ml-1.5 text-xs text-muted">(you)</span>
          )}
        </p>
        {country && (
          <p
            className={[
              "mt-0.5 truncate text-xs",
              country.is_knocked_out ? "text-danger" : "text-muted",
            ].join(" ")}
          >
            {country.flag_emoji} {country.name}
            {country.is_knocked_out ? " (out)" : ""}
          </p>
        )}
      </div>

      {/* Badges + optional kick button */}
      <div className="flex shrink-0 items-center gap-2">
        {isHost && (
          <Badge variant="gold" data-testid="host-badge">
            HOST
          </Badge>
        )}
        {kickButton}
      </div>
    </div>
  );
}
