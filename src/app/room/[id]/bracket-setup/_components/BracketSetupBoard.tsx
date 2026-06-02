"use client";

import { useActionState, useState } from "react";
import { saveBracket, type SaveBracketState } from "@/actions/room";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface TeamInfo {
  code: string;
  name: string;
  flag_emoji: string;
  player_name?: string | null;
}

interface MatchPair {
  teamA: TeamInfo;
  teamB: TeamInfo;
}

interface BracketSetupBoardProps {
  roomId: string;
  allTeams: TeamInfo[];     // ALL countries (58+), sorted player-owned first
  totalPlayers: number;
}

export function BracketSetupBoard({ roomId, allTeams, totalPlayers }: BracketSetupBoardProps) {
  const [state, formAction, isPending] = useActionState<SaveBracketState, FormData>(
    saveBracket,
    null
  );

  const [pairs, setPairs] = useState<MatchPair[]>([]);
  const [selected, setSelected] = useState<TeamInfo | null>(null);
  const [search, setSearch] = useState("");

  const assignedCodes = new Set(pairs.flatMap(p => [p.teamA.code, p.teamB.code]));

  const available = allTeams.filter(t =>
    !assignedCodes.has(t.code) &&
    (search.trim() === "" ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.code.toLowerCase().includes(search.toLowerCase()))
  );

  const canLock = pairs.length >= 2;
  const pairedPlayerCount = pairs.filter(p => p.teamA.player_name || p.teamB.player_name).length;

  function handleTeamClick(team: TeamInfo) {
    if (selected?.code === team.code) { setSelected(null); return; }
    if (!selected) { setSelected(team); return; }
    setPairs(prev => [...prev, { teamA: selected, teamB: team }]);
    setSelected(null);
  }

  function removePair(idx: number) {
    setPairs(prev => prev.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-8">
      {state?.error && (
        <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}

      {/* Stats bar */}
      <div className="flex flex-wrap justify-center gap-4 text-xs text-muted">
        <span>📋 {pairs.length} match{pairs.length !== 1 ? "es" : ""} set</span>
        <span>🥇 {pairedPlayerCount} with player teams</span>
        <span>👥 {totalPlayers} players in room</span>
      </div>

      {/* Instructions */}
      <p className="text-center text-sm text-muted">
        {selected ? (
          <>
            <span className="font-semibold text-gold">{selected.flag_emoji} {selected.name}</span>
            {" — now click their opponent"}
          </>
        ) : (
          "Click any team to select it, then click their opponent to create a match"
        )}
      </p>

      {/* Search */}
      <input
        type="search"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search teams…"
        className="mx-auto w-full max-w-sm rounded-xl border border-white/10 bg-surface px-4 py-2 text-sm text-white placeholder:text-muted outline-none focus:border-gold focus:ring-1 focus:ring-gold"
      />

      {/* Available teams grid */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted">
            Available Teams
          </h3>
          <span className="text-xs text-muted/60">{available.length} shown</span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 max-h-80 overflow-y-auto pr-1">
          {available.map(team => {
            const isSelected = selected?.code === team.code;
            return (
              <button
                key={team.code}
                type="button"
                onClick={() => handleTeamClick(team)}
                className={[
                  "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all duration-150",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                  isSelected
                    ? "border-gold bg-gold/15 shadow-[0_0_0_2px_rgba(255,215,0,0.3)]"
                    : team.player_name
                    ? "border-gold/30 bg-gold/5 hover:border-gold/60"
                    : "border-white/10 bg-surface hover:border-white/25",
                ].filter(Boolean).join(" ")}
              >
                <span className="text-2xl shrink-0" aria-hidden="true">{team.flag_emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white">{team.name}</p>
                  {team.player_name
                    ? <p className="truncate text-[10px] text-gold font-medium">{team.player_name}</p>
                    : <p className="text-[10px] text-muted/50">Neutral</p>
                  }
                </div>
                {isSelected && <span className="ml-auto shrink-0 text-gold text-xs">✓</span>}
              </button>
            );
          })}
          {available.length === 0 && search.trim() !== "" && (
            <p className="col-span-full py-4 text-center text-sm text-muted">
              No teams match &ldquo;{search}&rdquo;
            </p>
          )}
        </div>
      </div>

      {/* Configured matchups */}
      {pairs.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted">
            Bracket Matchups ({pairs.length})
          </h3>
          <div className="flex flex-col gap-2">
            {pairs.map((pair, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-surface px-4 py-3"
              >
                <span className="tabular-nums font-mono text-xs text-muted/60 w-5 shrink-0">#{idx + 1}</span>

                <div className="flex flex-1 items-center gap-2 min-w-0">
                  <span className="text-xl shrink-0">{pair.teamA.flag_emoji}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{pair.teamA.name}</p>
                    {pair.teamA.player_name && (
                      <p className="text-[10px] text-gold truncate">{pair.teamA.player_name}</p>
                    )}
                  </div>
                </div>

                <span className="shrink-0 text-[10px] font-bold text-muted">VS</span>

                <div className="flex flex-1 items-center gap-2 min-w-0">
                  <span className="text-xl shrink-0">{pair.teamB.flag_emoji}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{pair.teamB.name}</p>
                    {pair.teamB.player_name && (
                      <p className="text-[10px] text-gold truncate">{pair.teamB.player_name}</p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removePair(idx)}
                  aria-label={`Remove match ${idx + 1}`}
                  className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg border border-white/10 text-lg text-muted hover:border-danger/50 hover:text-danger transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lock bracket */}
      {canLock && (
        <form action={formAction}>
          <input type="hidden" name="roomId" value={roomId} />
          {pairs.map((pair, idx) => (
            <span key={idx}>
              <input type="hidden" name={`match_${idx + 1}_a`} value={pair.teamA.code} />
              <input type="hidden" name={`match_${idx + 1}_b`} value={pair.teamB.code} />
            </span>
          ))}
          <div className="flex flex-col gap-2">
            {assignedCodes.size < allTeams.length && (
              <p className="text-center text-xs text-muted/60">
                {allTeams.length - assignedCodes.size} teams not placed — lock now or keep pairing.
              </p>
            )}
            <Button type="submit" variant="primary" size="lg" fullWidth disabled={isPending}>
              {isPending ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner size="sm" color="white" />
                  Saving bracket…
                </span>
              ) : (
                `🏆 Lock Bracket — ${pairs.length * 2} teams · ${pairs.length} matches`
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
