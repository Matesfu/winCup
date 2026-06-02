interface LobbyProgressProps {
  joined: number;
  total: number;
}

export function LobbyProgress({ joined, total }: LobbyProgressProps) {
  const isFull = joined >= total && total > 0;
  const pct = total > 0 ? Math.min((joined / total) * 100, 100) : 0;

  return (
    <div className="flex flex-col gap-2" data-testid="lobby-progress">
      {/* Counter */}
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium ${isFull ? "text-success" : "text-white"}`}>
          {isFull
            ? "All players joined! Ready to draw. 🎉"
            : `${joined} of ${total} players joined`}
        </span>
        <span className="tabular-nums text-xs text-muted">
          {joined}/{total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          data-testid="progress-bar"
          className={`h-full rounded-full transition-all duration-500 ${
            isFull ? "bg-success" : "bg-gold"
          }`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={joined}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={`${joined} of ${total} players joined`}
        />
      </div>
    </div>
  );
}
