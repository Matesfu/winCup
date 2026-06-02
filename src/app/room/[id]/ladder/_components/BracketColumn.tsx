import { MatchCard } from "./MatchCard";
import type { BracketMatchup, StageKey } from "@/lib/bracket";
import { STAGE_LABELS } from "@/lib/bracket";

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

interface BracketColumnProps {
  stage: StageKey;
  matchups: BracketMatchup[];
  roomId: string;
  isHost: boolean;
  currentUserId: string;
  countriesMap: Map<string, CountryInfo>;
  playersMap: Map<string, PlayerInfo>;
}

export function BracketColumn({
  stage,
  matchups,
  roomId,
  isHost,
  currentUserId,
  countriesMap,
  playersMap,
}: BracketColumnProps) {
  const stageMatchups = matchups.filter((m) => m.stage === stage);

  return (
    <div
      data-testid={`bracket-column-${stage}`}
      className="flex flex-col gap-2 min-w-[160px]"
    >
      {/* Stage heading */}
      <h3 className="text-center text-[11px] font-bold uppercase tracking-widest text-muted px-2">
        {STAGE_LABELS[stage]}
      </h3>

      {/* Vertically centered match cards */}
      <div className="flex flex-1 flex-col justify-around gap-6">
        {stageMatchups.map((matchup) => (
          <MatchCard
            key={`${matchup.stage}-${matchup.matchOrder}`}
            matchup={matchup}
            roomId={roomId}
            isHost={isHost}
            currentUserId={currentUserId}
            countriesMap={countriesMap}
            playersMap={playersMap}
          />
        ))}
      </div>
    </div>
  );
}
