"use client";

import { useEffect, useState } from "react";

interface Particle {
  angle: number;
  distance: number;
  color: string;
  size: number;
}

const COLORS = ["#FFD700", "#10B981", "#FFFFFF", "#EF4444", "#60A5FA"];

const PARTICLES: Particle[] = Array.from({ length: 20 }, (_, i) => ({
  angle: (i / 20) * 360,
  distance: 55 + (i % 5) * 15,
  color: COLORS[i % COLORS.length],
  size: i % 3 === 0 ? 10 : 7,
}));

interface ConfettiBurstProps {
  active: boolean;
}

export function ConfettiBurst({ active }: ConfettiBurstProps) {
  const [exploded, setExploded] = useState(false);

  useEffect(() => {
    if (!active) {
      setExploded(false);
      return;
    }
    // Trigger on next animation frame so the browser registers
    // the initial position before starting the transition
    const id = requestAnimationFrame(() => setExploded(true));
    return () => cancelAnimationFrame(id);
  }, [active]);

  if (!active) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {PARTICLES.map((p, i) => {
        const rad = (p.angle * Math.PI) / 180;
        const dx = Math.cos(rad) * p.distance;
        const dy = Math.sin(rad) * p.distance;

        return (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              left: `calc(50% - ${p.size / 2}px)`,
              top: `calc(50% - ${p.size / 2}px)`,
              transform: exploded
                ? `translate(${dx}px, ${dy}px) scale(0)`
                : "translate(0px, 0px) scale(1)",
              opacity: exploded ? 0 : 1,
              transition: exploded
                ? `transform 700ms cubic-bezier(0.25, 0.46, 0.45, 0.94) ${i * 15}ms,
                   opacity 700ms ease-out ${i * 15}ms`
                : "none",
            }}
          />
        );
      })}
    </div>
  );
}
