import Link from "next/link";

interface NoWinnerScreenProps {
  championCountryName: string;
  championCountryFlag: string;
  stakeAmount: number | null;
}

export function NoWinnerScreen({
  championCountryName,
  championCountryFlag,
  stakeAmount,
}: NoWinnerScreenProps) {
  const shareText = `⚽ ${championCountryFlag} ${championCountryName} won the tournament! We played WinCup but nobody owned them. Better luck next time! 🤷`;

  return (
    <main className="flex min-h-[90svh] flex-col items-center justify-center gap-6 px-4 py-12 text-center">

      {/* Icon */}
      <div className="text-7xl animate-slide-up" aria-hidden="true">🤷</div>

      {/* Heading */}
      <div className="animate-slide-up flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold text-white sm:text-4xl" data-testid="no-winner-heading">
          No Winner This Time
        </h1>
        <p
          className="text-sm italic text-muted"
          data-testid="no-winner-message"
        >
          The Cup winner wasn&apos;t in this room, stakes returned 🤷
        </p>
      </div>

      {/* Champion country */}
      <div className="animate-slide-up flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-surface px-8 py-5">
        <p className="text-xs text-muted">Actual champion</p>
        <span
          className="text-7xl"
          aria-label={championCountryName}
          data-testid="champion-country-flag"
        >
          {championCountryFlag}
        </span>
        <span
          className="text-xl font-semibold text-white"
          data-testid="champion-country-name"
        >
          {championCountryName}
        </span>
        <p className="text-xs text-muted">
          Congratulations to {championCountryName}, they were not in this room!
        </p>
      </div>

      {/* Stake note */}
      {stakeAmount !== null && (
        <div className="animate-slide-up rounded-xl border border-white/10 bg-surface/60 px-5 py-3 text-center">
          <p className="text-sm text-muted">
            No one wins the {stakeAmount} Birr pot.{" "}
            <span className="text-white">Stakes returned to everyone.</span>
          </p>
        </div>
      )}

      {/* Share button */}
      <a
        href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="whatsapp-share"
        className="animate-slide-up inline-flex items-center gap-2 rounded-2xl border border-white/15 px-6 py-3 text-sm font-semibold text-white transition-all hover:border-white/30 hover:bg-white/5"
      >
        <span aria-hidden="true">📲</span>
        Share Result
      </a>

      {/* Start New Room */}
      <Link
        href="/room/create"
        data-testid="start-new-room"
        className="animate-slide-up inline-flex items-center gap-2 rounded-2xl bg-gold px-6 py-3 text-base font-bold text-black transition-all hover:brightness-110"
      >
        Start New Room →
      </Link>

    </main>
  );
}
