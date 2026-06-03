"use client";

import Link from "next/link";
import { FullScreenConfetti } from "./FullScreenConfetti";

interface WinnerScreenProps {
  playerName: string;
  playerAvatar: string | null;
  countryName: string;
  countryFlag: string;
  stakeAmount: number | null;
  winMessage: string;
}

export function WinnerScreen({
  playerName,
  playerAvatar,
  countryName,
  countryFlag,
  stakeAmount,
  winMessage,
}: WinnerScreenProps) {
  const stakeText = stakeAmount ? ` and took the ${stakeAmount} Birr pot` : "";
  const shareText = `🏆 I won WinCup! ${countryFlag} ${countryName} took the cup${stakeText}! Play at wincup.app`;

  return (
    <>
      <FullScreenConfetti />

      <main className="relative z-20 flex min-h-[90svh] flex-col items-center justify-center gap-6 px-4 py-12 text-center">

        {/* Trophy */}
        <div className="animate-slide-up text-7xl" aria-hidden="true">🏆</div>

        {/* Heading */}
        <div className="animate-slide-up flex flex-col gap-1">
          <h1 className="text-4xl font-extrabold text-gold sm:text-5xl">
            WinCup Winner!
          </h1>
          <p className="text-sm italic text-muted">{winMessage}</p>
        </div>

        {/* Player */}
        <div className="animate-slide-up flex flex-col items-center gap-2">
          <span className="text-5xl" aria-hidden="true">{playerAvatar ?? "👤"}</span>
          <span
            className="text-3xl font-bold text-white sm:text-4xl"
            data-testid="winner-player-name"
          >
            {playerName}
          </span>
        </div>

        {/* Country */}
        <div className="animate-slide-up flex flex-col items-center gap-2">
          <span
            className="text-8xl"
            aria-label={countryName}
            data-testid="winner-country-flag"
          >
            {countryFlag}
          </span>
          <span
            className="text-2xl font-semibold text-white"
            data-testid="winner-country-name"
          >
            {countryName}
          </span>
        </div>

        {/* Stake */}
        {stakeAmount !== null && (
          <div className="animate-slide-up flex flex-col items-center gap-1 rounded-2xl border border-gold/30 bg-gold/5 px-6 py-3">
            <span className="text-xs text-muted">Prize pot</span>
            <span className="text-2xl font-extrabold text-gold tabular-nums">
              {stakeAmount} Birr
            </span>
          </div>
        )}

        {/* WhatsApp share */}
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="whatsapp-share"
          className="animate-slide-up inline-flex items-center gap-2 rounded-2xl bg-[#25D366] px-6 py-3 text-base font-bold text-white transition-all hover:brightness-110 active:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]"
        >
          <span aria-hidden="true">📲</span>
          Share to WhatsApp
        </a>

        {/* Start New Room */}
        <Link
          href="/room/create"
          data-testid="start-new-room"
          className="inline-flex items-center gap-2 rounded-2xl border border-gold/50 px-6 py-3 text-base font-semibold text-gold transition-all hover:bg-gold/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          Start New Room →
        </Link>

      </main>
    </>
  );
}
