import type { AssignmentMode } from "@/lib/types/database";

interface LobbyProgressProps {
  joined: number;
  total: number;
  assignmentMode: AssignmentMode;
  chosen: number;
  isReady: boolean;
}

export function LobbyProgress({
  joined,
  total,
  assignmentMode,
  chosen,
  isReady,
}: LobbyProgressProps) {
  const isPlayerChoice = assignmentMode === "player_choice";
  const progressValue = isPlayerChoice ? chosen : joined;
  const pct = total > 0 ? Math.min((progressValue / total) * 100, 100) : 0;
  const label = isPlayerChoice
    ? `${chosen} of ${total} countries chosen`
    : `${joined} players joined from ${total} available countries`;
  const readyText = isPlayerChoice
    ? "Ready to start. Every player has a country. 🎉"
    : "Ready to draw. Extra countries can stay unassigned. 🎉";

  return (
    <div className="flex flex-col gap-2" data-testid="lobby-progress">
      {/* Counter */}
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium ${isReady ? "text-success" : "text-white"}`}>
          {isReady ? readyText : label}
        </span>
        <span className="tabular-nums text-xs text-muted">
          {progressValue}/{total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          data-testid="progress-bar"
          className={`h-full rounded-full transition-all duration-500 ${
            isReady ? "bg-success" : "bg-gold"
          }`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={progressValue}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={label}
        />
      </div>
    </div>
  );
}
