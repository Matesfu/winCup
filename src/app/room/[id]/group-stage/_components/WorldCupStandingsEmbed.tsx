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

    </section>
  );
}
