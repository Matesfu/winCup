"use client";

import { useEffect, useState } from "react";

const COLORS = [
  "#FFD700", "#10B981", "#FFFFFF", "#60A5FA",
  "#F59E0B", "#EF4444", "#A78BFA", "#34D399",
];

interface Particle {
  id: number;
  left: string;
  size: number;
  color: string;
  duration: string;
  delay: string;
  shape: "square" | "circle";
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${(i * 100) / count + Math.sin(i) * 5}%`,
    size: 5 + (i % 5) * 2,       // 5–13px
    color: COLORS[i % COLORS.length],
    duration: `${2.5 + (i % 6) * 0.5}s`,   // 2.5–5.5s
    delay: `${(i % 8) * 0.35}s`,             // 0–2.8s stagger
    shape: i % 3 === 0 ? "circle" : "square",
  }));
}

const PARTICLES = generateParticles(45);

interface FullScreenConfettiProps {
  active?: boolean;
}

export function FullScreenConfetti({ active = true }: FullScreenConfettiProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (active) setMounted(true);
  }, [active]);

  if (!mounted || !active) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-10 overflow-hidden"
      data-testid="full-screen-confetti"
    >
      {PARTICLES.map((p) => (
        <div
          key={p.id}
          className="animate-confetti-fall absolute top-0"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === "circle" ? "50%" : "2px",
            animationDuration: p.duration,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
}
