import { type ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import type { Player } from "@/lib/types/database";

interface PlayerCardProps {
  player: Player;
  isHost: boolean;
  isCurrentUser: boolean;
  animate?: boolean;
  /** Optional kick button rendered on the right — provided by LobbyRealtime for the host */
  kickButton?: ReactNode;
}

export function PlayerCard({
  player,
  isHost,
  isCurrentUser,
  animate = false,
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

      {/* Name */}
      <span className="flex-1 truncate text-sm font-medium text-white">
        {player.name}
        {isCurrentUser && (
          <span className="ml-1.5 text-xs text-muted">(you)</span>
        )}
      </span>

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
