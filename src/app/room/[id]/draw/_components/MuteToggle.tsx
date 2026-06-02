"use client";

import { resumeAudio } from "@/lib/sound";

interface MuteToggleProps {
  muted: boolean;
  onToggle: () => void;
}

export function MuteToggle({ muted, onToggle }: MuteToggleProps) {
  function handleClick() {
    resumeAudio(); // unblock browser autoplay on first interaction
    onToggle();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={muted ? "Unmute sound" : "Mute sound"}
      data-testid="mute-toggle"
      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-surface/80 px-3 py-2 text-xs font-medium text-muted backdrop-blur transition-colors hover:border-white/25 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
    >
      <span aria-hidden="true">{muted ? "🔇" : "🔊"}</span>
      <span className="hidden sm:inline">{muted ? "Unmute" : "Mute"}</span>
    </button>
  );
}
