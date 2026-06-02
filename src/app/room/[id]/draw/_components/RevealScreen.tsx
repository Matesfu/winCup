"use client";

import { useEffect, useState } from "react";
import { FlagCarousel } from "./FlagCarousel";
import { ConfettiBurst } from "./ConfettiBurst";
import { buildFlagSequence } from "@/lib/draw";
import type { Player } from "@/lib/types/database";

type RevealPhase = "spinning" | "landing" | "showing";

interface CountryInfo {
  code: string;
  name: string;
  flag_emoji: string;
}

interface RevealScreenProps {
  player: Pick<Player, "id" | "name" | "avatar_emoji" | "assigned_country">;
  assignedCountry: CountryInfo;
  allCountries: CountryInfo[];
  isMuted: boolean;
  /** Called when this reveal is fully complete (after showing the result) */
  onRevealComplete: () => void;
}

const SHOWING_DURATION_MS = 2800;

export function RevealScreen({
  player,
  assignedCountry,
  allCountries,
  isMuted,
  onRevealComplete,
}: RevealScreenProps) {
  const [phase, setPhase] = useState<RevealPhase>("spinning");
  const [confettiActive, setConfettiActive] = useState(false);

  // Pre-compute the flag sequence once on mount
  const sequence = buildFlagSequence(allCountries, assignedCountry.code);

  function handleCarouselComplete() {
    setPhase("landing");
    setConfettiActive(true);
    // After landing animation, move to showing phase
    setTimeout(() => {
      setPhase("showing");
    }, 800);
  }

  useEffect(() => {
    if (phase !== "showing") return;
    const timer = setTimeout(onRevealComplete, SHOWING_DURATION_MS);
    return () => clearTimeout(timer);
  }, [phase, onRevealComplete]);

  return (
    <div className="flex min-h-[70svh] flex-col items-center justify-center gap-6 px-4 py-8">
      {/* Player info */}
      <div className="animate-fade-in text-center">
        <p className="text-sm font-medium text-muted">Drawing for…</p>
        <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-surface px-5 py-3">
          <span className="text-2xl" aria-hidden="true">
            {player.avatar_emoji ?? "👤"}
          </span>
          <span className="text-lg font-bold text-white">{player.name}</span>
        </div>
      </div>

      {/* Slot machine */}
      {phase === "spinning" && (
        <div className="w-full max-w-sm animate-fade-in">
          <FlagCarousel
            sequence={sequence}
            onComplete={handleCarouselComplete}
            isMuted={isMuted}
          />
          <p className="mt-3 text-center text-xs text-muted">
            Shuffling…
          </p>
        </div>
      )}

      {/* Landing + reveal */}
      {(phase === "landing" || phase === "showing") && (
        <div className="relative flex flex-col items-center gap-4 animate-slide-up">
          {/* Big flag with confetti */}
          <div className="relative flex h-28 w-28 items-center justify-center rounded-3xl border-2 border-gold bg-gold/10">
            <span
              className={`text-6xl transition-all duration-500 ${
                phase === "showing" ? "scale-100" : "scale-90"
              }`}
              data-testid="revealed-flag"
              aria-label={assignedCountry.name}
            >
              {assignedCountry.flag_emoji}
            </span>
            <ConfettiBurst active={confettiActive} />
          </div>

          {/* Country name */}
          <div className="text-center">
            <p
              className={`text-3xl font-extrabold tracking-wide text-gold transition-all duration-500 ${
                phase === "showing" ? "opacity-100 scale-100" : "opacity-0 scale-95"
              } sm:text-4xl`}
              data-testid="revealed-country-name"
            >
              {assignedCountry.name}
            </p>
            <p className="mt-1 text-sm text-muted">{player.name}&apos;s country</p>
          </div>
        </div>
      )}
    </div>
  );
}
