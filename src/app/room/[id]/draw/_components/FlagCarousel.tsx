"use client";

import { useEffect, useRef, useState } from "react";
import { playTick, playThud } from "@/lib/sound";

const FLAG_WIDTH = 80; // px per flag cell

// Speed schedule: interval in ms between flag advances
// Steps 0..FAST_STEPS-1: constant fast speed
// Steps FAST_STEPS..end: multiply by SLOW_FACTOR each step
const FAST_STEPS = 22;
const FAST_INTERVAL = 70; // ms
const SLOW_FACTOR = 1.22;

interface FlagCarouselProps {
  /** Pre-built sequence from buildFlagSequence() — target is last element */
  sequence: { code: string; flag_emoji: string }[];
  /** Called when the carousel finishes landing on the target */
  onComplete: () => void;
  isMuted: boolean;
}

export function FlagCarousel({ sequence, onComplete, isMuted }: FlagCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [transitionDuration, setTransitionDuration] = useState(FAST_INTERVAL);
  const [isLanding, setIsLanding] = useState(false);
  const stepRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);

  // Total steps to reach the last element (target)
  const totalSteps = sequence.length - 1;

  useEffect(() => {
    if (sequence.length === 0) return;

    function tick() {
      const step = stepRef.current;
      if (step >= totalSteps) {
        // Landed on target
        if (!completedRef.current) {
          completedRef.current = true;
          setIsLanding(true);
          if (!isMuted) playThud();
          // Call onComplete after a brief pause for the landing to settle
          setTimeout(() => onComplete(), 400);
        }
        return;
      }

      stepRef.current += 1;
      setCurrentIndex(stepRef.current);
      if (!isMuted) playTick();

      // Calculate next interval
      let nextInterval: number;
      if (step < FAST_STEPS) {
        nextInterval = FAST_INTERVAL;
      } else {
        const slowStep = step - FAST_STEPS;
        nextInterval = FAST_INTERVAL * Math.pow(SLOW_FACTOR, slowStep + 1);
      }
      setTransitionDuration(Math.min(nextInterval, 1200));
      timerRef.current = setTimeout(tick, nextInterval);
    }

    timerRef.current = setTimeout(tick, FAST_INTERVAL);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // Offset so the current flag is centred in the container
  // Container is 5 × FLAG_WIDTH wide, centred flag is at position 2 (0-indexed)
  const visibleCount = 5;
  const containerWidth = visibleCount * FLAG_WIDTH;
  const centreOffset = Math.floor(visibleCount / 2) * FLAG_WIDTH;
  const trackOffset = centreOffset - currentIndex * FLAG_WIDTH;

  return (
    <div
      className="relative mx-auto overflow-hidden rounded-2xl bg-surface"
      style={{ width: containerWidth, height: FLAG_WIDTH }}
      data-testid="flag-carousel"
      aria-label="Flag carousel animation"
      aria-live="polite"
    >
      {/* Fixed golden selection frame */}
      <div
        className={[
          "pointer-events-none absolute inset-y-0 z-10",
          "border-2 rounded-xl",
          isLanding
            ? "border-gold bg-gold/20 shadow-[0_0_24px_rgba(255,215,0,0.5)]"
            : "border-gold/60 bg-gold/5",
        ].join(" ")}
        style={{
          left: centreOffset,
          width: FLAG_WIDTH,
          transition: "all 0.3s ease",
        }}
      />

      {/* Scrolling flag track */}
      <div
        className="absolute top-0 flex items-center"
        style={{
          transform: `translateX(${trackOffset}px)`,
          transition: `transform ${transitionDuration}ms ease-out`,
          height: FLAG_WIDTH,
        }}
      >
        {sequence.map((flag, i) => (
          <div
            key={`${flag.code}-${i}`}
            className="flex shrink-0 items-center justify-center text-4xl"
            style={{ width: FLAG_WIDTH, height: FLAG_WIDTH }}
            aria-hidden={i !== currentIndex}
          >
            {flag.flag_emoji}
          </div>
        ))}
      </div>

      {/* Side fade gradients for visual polish */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent z-10" />
    </div>
  );
}
