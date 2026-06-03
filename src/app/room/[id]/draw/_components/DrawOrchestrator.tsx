"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MuteToggle } from "./MuteToggle";
import { RevealScreen } from "./RevealScreen";
import { DrawSummary } from "./DrawSummary";
import { subscribeRoomUpdates } from "@/lib/supabase/realtime";
import type { Player } from "@/lib/types/database";

type DrawPhase = "waiting" | "revealing" | "complete";

interface CountryInfo {
  code: string;
  name: string;
  flag_emoji: string;
}

type DrawPlayer = Pick<Player, "id" | "name" | "avatar_emoji" | "assigned_country">;

interface DrawOrchestratorProps {
  roomId: string;
  players: DrawPlayer[];
  countries: CountryInfo[];
  allAssigned: boolean;
}

const WAIT_BEFORE_FIRST_REVEAL_MS = 1200;

export function DrawOrchestrator({
  roomId,
  players,
  countries,
  allAssigned,
}: DrawOrchestratorProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<DrawPhase>("waiting");
  const [revealIndex, setRevealIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // Build a map for O(1) country lookups
  const countriesMap = new Map(countries.map((c) => [c.code, c]));

  // Subscription to room status changes (e.g. room enters group stage)
  useEffect(() => {
    const unsubscribe = subscribeRoomUpdates(roomId, (updated) => {
      if (updated.status === "group_stage") {
        router.replace(`/room/${roomId}/group-stage`);
      }
    });
    return unsubscribe;
  }, [roomId, router]);

  // Auto-start reveals after a brief pause (gives page time to settle)
  useEffect(() => {
    if (!allAssigned) return; // wait until assignments are loaded
    const timer = setTimeout(() => setPhase("revealing"), WAIT_BEFORE_FIRST_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [allAssigned]);

  const handleRevealComplete = useCallback(() => {
    setRevealIndex((prev) => {
      const next = prev + 1;
      if (next >= players.length) {
        setPhase("complete");
        return prev;
      }
      return next;
    });
  }, [players.length]);

  // Current player being revealed
  const currentPlayer = players[revealIndex];
  const assignedCountry = currentPlayer?.assigned_country
    ? countriesMap.get(currentPlayer.assigned_country)
    : null;

  return (
    <div className="relative flex min-h-[calc(100svh-60px)] flex-col bg-background">
      {/* Mute toggle — fixed top-right during reveals */}
      {phase === "revealing" && (
        <div className="absolute right-4 top-4 z-30">
          <MuteToggle muted={isMuted} onToggle={() => setIsMuted((m) => !m)} />
        </div>
      )}

      {/* Waiting phase */}
      {phase === "waiting" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16">
          {!allAssigned ? (
            <>
              <div className="text-5xl animate-pulse">🎲</div>
              <p className="text-sm text-muted">Preparing the draw…</p>
            </>
          ) : (
            <>
              <div className="text-5xl animate-pulse">🎲</div>
              <h1 className="text-2xl font-extrabold text-white">
                The draw is about to begin
              </h1>
              <p className="text-sm text-muted">Get ready…</p>
            </>
          )}
        </div>
      )}

      {/* Reveal phase — one player at a time */}
      {phase === "revealing" && currentPlayer && assignedCountry && (
        <RevealScreen
          key={currentPlayer.id}  // remount for each new player
          player={currentPlayer}
          assignedCountry={assignedCountry}
          allCountries={countries}
          isMuted={isMuted}
          onRevealComplete={handleRevealComplete}
        />
      )}

      {/* Missing country fallback (should not happen in practice) */}
      {phase === "revealing" && currentPlayer && !assignedCountry && (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted">Assignment missing for {currentPlayer.name}…</p>
        </div>
      )}

      {/* Complete phase — summary */}
      {phase === "complete" && (
        <DrawSummary
          roomId={roomId}
          players={players}
          countriesMap={countriesMap}
        />
      )}
    </div>
  );
}
