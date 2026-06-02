"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BracketColumn } from "./BracketColumn";
import { subscribeLadder } from "@/lib/supabase/realtime";
import {
  getStartingStage,
  getActiveStages,
  computeBracketMatchups,
} from "@/lib/bracket";
import type { RoomTeam, Match, RoomPublic, Player } from "@/lib/types/database";

interface CountryInfo {
  code: string;
  name: string;
  flag_emoji: string;
}

interface LadderRealtimeProps {
  roomId: string;
  initialRoom: Pick<RoomPublic, "id" | "code" | "status" | "host_user_id">;
  initialRoomTeams: RoomTeam[];
  initialMatches: Match[];
  countriesMap: Map<string, CountryInfo>;
  playersMap: Map<string, { id: string; name: string; avatar_emoji: string | null }>;
  isHost: boolean;
  currentUserId: string;
}

export function LadderRealtime({
  roomId,
  initialRoom,
  initialRoomTeams,
  initialMatches,
  countriesMap,
  playersMap,
  isHost,
  currentUserId,
}: LadderRealtimeProps) {
  const router = useRouter();
  const [roomTeams, setRoomTeams] = useState<RoomTeam[]>(initialRoomTeams);
  const [matches, setMatches] = useState<Match[]>(initialMatches);

  // Subscribe to Realtime events
  useEffect(() => {
    const unsubscribe = subscribeLadder(roomId, {
      onTeamUpdated(updated) {
        setRoomTeams((prev) =>
          prev.map((t) =>
            t.id === updated.id ? { ...t, ...(updated as Partial<RoomTeam>) } : t
          )
        );
      },
      onMatchUpserted(updated) {
        setMatches((prev) => {
          const exists = prev.find((m) => m.id === updated.id);
          if (exists) {
            return prev.map((m) => (m.id === updated.id ? { ...m, ...(updated as Partial<Match>) } : m));
          }
          return [...prev, updated as Match];
        });
      },
      onRoomStatusUpdated(updated) {
        if (updated.status === "finished") {
          router.push(`/room/${roomId}/winner`);
        }
      },
    });
    return unsubscribe;
  }, [roomId, router]);

  if (roomTeams.length === 0) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <div className="text-center">
          <p className="text-lg text-muted">Bracket is being built…</p>
          <p className="mt-2 text-sm text-muted/60">Refresh if this takes too long.</p>
        </div>
      </main>
    );
  }

  const startingStage = getStartingStage(roomTeams.length);
  const activeStages = getActiveStages(startingStage);
  const matchups = computeBracketMatchups(roomTeams, matches, activeStages);

  // Check if there's a champion
  const champion = roomTeams.find((t) => t.current_stage === "champion");

  return (
    <main className="flex flex-1 flex-col">
      {/* Page heading */}
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-xl font-extrabold text-white">Knockout Bracket</h1>
        <p className="text-xs text-muted mt-0.5">
          {champion
            ? `Champion: ${countriesMap.get(champion.country_code)?.name ?? champion.country_code} 🏆`
            : "Follow your team through the knockout rounds"}
        </p>
      </div>

      {/* Horizontally-scrolling bracket */}
      <div className="overflow-x-auto pb-6">
        <div
          className="flex items-start gap-4 px-4 pt-2"
          style={{ minWidth: "max-content" }}
          aria-label="Knockout bracket"
        >
          {activeStages.map((stage, i) => (
            <div key={stage} className="flex items-center gap-4">
              <BracketColumn
                stage={stage}
                matchups={matchups}
                roomId={roomId}
                isHost={isHost}
                currentUserId={currentUserId}
                countriesMap={countriesMap}
                playersMap={playersMap}
              />
              {/* Arrow connector between columns */}
              {i < activeStages.length - 1 && (
                <div className="text-muted/30 text-sm self-center shrink-0">→</div>
              )}
            </div>
          ))}

          {/* Champion column */}
          {champion && (
            <div className="flex items-center gap-4">
              <div className="text-muted/30 text-sm self-center shrink-0">→</div>
              <div className="flex flex-col gap-2 min-w-[140px] items-center">
                <h3 className="text-center text-[11px] font-bold uppercase tracking-widest text-gold px-2">
                  Champion
                </h3>
                <div className="flex flex-col items-center gap-1 rounded-2xl border border-gold bg-gold/10 px-4 py-3 text-center">
                  <span className="text-4xl" aria-hidden="true">
                    {countriesMap.get(champion.country_code)?.flag_emoji ?? "🏆"}
                  </span>
                  <span className="text-sm font-bold text-gold">
                    {countriesMap.get(champion.country_code)?.name ?? champion.country_code}
                  </span>
                  {champion.player_id && playersMap.get(champion.player_id) && (
                    <span className="text-xs text-muted">
                      {playersMap.get(champion.player_id)?.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Host hint */}
      {isHost && !champion && (
        <p className="px-4 pb-4 text-center text-xs text-muted">
          As host, you can manually advance match results using the buttons in each match card.
        </p>
      )}
    </main>
  );
}
