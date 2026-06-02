import { FIFA_WORLD_CUP_2026_FIXTURES_URL, type FifaStage } from "@/lib/fifa";

function buildStageFixturesUrl(fifaStage: FifaStage) {
  const params = new URLSearchParams({
    country: "",
    "wtw-filter": "ALL",
    stage: fifaStage,
    team: "",
  });

  return `${FIFA_WORLD_CUP_2026_FIXTURES_URL}?${params.toString()}`;
}

interface WorldCupStandingsEmbedProps {
  fifaStage: FifaStage;
}

export function WorldCupStandingsEmbed({ fifaStage }: WorldCupStandingsEmbedProps) {
  const fifaFixturesUrl = buildStageFixturesUrl(fifaStage);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-white">Official FIFA Fixtures</h2>
          <p className="text-xs text-muted">
            Open the selected FIFA stage directly, then use each player card for team-specific matches.
          </p>
        </div>
        <a
          href={fifaFixturesUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center justify-center rounded-lg border border-gold/40 px-3 py-2 text-xs font-bold text-gold transition-colors hover:bg-gold/10"
        >
          Open official page
        </a>
      </div>

      <div className="grid gap-4 rounded-2xl border border-white/10 bg-surface/55 p-4 shadow-lift sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-lg font-black text-gold">
            FIFA
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">{fifaStage} fixtures on FIFA.com</p>
            <p className="mt-1 max-w-2xl text-xs text-muted">
              FIFA blocks third-party iframe display with browser security headers. WinCup keeps your room status here and opens the official scores and fixtures page when needed.
            </p>
          </div>
        </div>
        <a
          href={fifaFixturesUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-full items-center justify-center rounded-xl bg-gold px-4 py-3 text-sm font-black text-black transition-colors hover:brightness-110 sm:w-auto"
        >
          View fixtures
        </a>
      </div>
    </section>
  );
}
