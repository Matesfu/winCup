"use client";

import { useActionState } from "react";
import { TeamSlot } from "./TeamSlot";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { advanceMatch, type AdvanceMatchState } from "@/actions/room";
import type { BracketMatchup } from "@/lib/bracket";

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

interface MatchCardProps {
  matchup: BracketMatchup;
  roomId: string;
  isHost: boolean;
  currentUserId: string;
  countriesMap: Map<string, CountryInfo>;
  playersMap: Map<string, PlayerInfo>;
}

export function MatchCard({
  matchup,
  roomId,
  isHost,
  currentUserId,
  countriesMap,
  playersMap,
}: MatchCardProps) {
  const [state, formAction, isPending] = useActionState<AdvanceMatchState, FormData>(
    advanceMatch,
    null
  );

  const { slotA, slotB, winnerCode, stage } = matchup;

  const countryA = slotA.teamCode ? (countriesMap.get(slotA.teamCode) ?? null) : null;
  const countryB = slotB.teamCode ? (countriesMap.get(slotB.teamCode) ?? null) : null;
  const playerA = slotA.playerId ? (playersMap.get(slotA.playerId) ?? null) : null;
  const playerB = slotB.playerId ? (playersMap.get(slotB.playerId) ?? null) : null;

  const isCurrentUserA = slotA.playerId !== null && playersMap.get(slotA.playerId) !== undefined &&
    playersMap.get(slotA.playerId)?.id === currentUserId;
  const isCurrentUserB = slotB.playerId !== null && playersMap.get(slotB.playerId) !== undefined &&
    playersMap.get(slotB.playerId)?.id === currentUserId;

  const bothKnown = slotA.teamCode !== null && slotB.teamCode !== null;
  const matchDecided = winnerCode !== null;
  const showOverride = isHost && bothKnown && !matchDecided;

  return (
    <div
      data-testid="match-card"
      className="flex flex-col gap-1 rounded-xl border border-white/8 bg-surface/60 p-2 min-w-[140px] max-w-[160px]"
    >
      {/* Team A */}
      <TeamSlot
        slot={slotA}
        country={countryA}
        player={playerA}
        isWinner={winnerCode !== null && winnerCode === slotA.teamCode}
        isCurrentUser={isCurrentUserA}
      />

      {/* VS divider */}
      <div className="flex items-center justify-center">
        <span className="text-[10px] text-muted/50">vs</span>
      </div>

      {/* Team B */}
      <TeamSlot
        slot={slotB}
        country={countryB}
        player={playerB}
        isWinner={winnerCode !== null && winnerCode === slotB.teamCode}
        isCurrentUser={isCurrentUserB}
      />

      {/* Host override buttons */}
      {showOverride && (
        <div className="mt-1 flex flex-col gap-1">
          {state?.error && (
            <p className="text-[10px] text-danger text-center">{state.error}</p>
          )}
          {isPending ? (
            <div className="flex justify-center py-1">
              <LoadingSpinner size="sm" color="gold" />
            </div>
          ) : (
            <>
              {slotA.teamCode && slotB.teamCode && (
                <>
                  <form action={formAction}>
                    <input type="hidden" name="roomId" value={roomId} />
                    <input type="hidden" name="winnerCode" value={slotA.teamCode} />
                    <input type="hidden" name="loserCode" value={slotB.teamCode} />
                    <input type="hidden" name="stage" value={stage} />
                    <button
                      type="submit"
                      data-testid={`advance-${slotA.teamCode}`}
                      className="w-full rounded-md bg-gold/10 border border-gold/30 px-2 py-1 text-[10px] font-medium text-gold hover:bg-gold/20 transition-colors"
                    >
                      {countryA?.flag_emoji} Wins →
                    </button>
                  </form>
                  <form action={formAction}>
                    <input type="hidden" name="roomId" value={roomId} />
                    <input type="hidden" name="winnerCode" value={slotB.teamCode} />
                    <input type="hidden" name="loserCode" value={slotA.teamCode} />
                    <input type="hidden" name="stage" value={stage} />
                    <button
                      type="submit"
                      data-testid={`advance-${slotB.teamCode}`}
                      className="w-full rounded-md bg-gold/10 border border-gold/30 px-2 py-1 text-[10px] font-medium text-gold hover:bg-gold/20 transition-colors"
                    >
                      {countryB?.flag_emoji} Wins →
                    </button>
                  </form>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
