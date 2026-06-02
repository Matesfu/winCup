export const FIFA_WORLD_CUP_2026_FIXTURES_URL =
  "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures";

export const FIFA_STAGES = [
  "First Stage",
  "Round of 32",
  "Round of 16",
  "Quarter-final",
  "Semi-final",
  "Play-off for third place",
  "Final",
] as const;

export type FifaStage = (typeof FIFA_STAGES)[number];
export type FifaFixtureStage = FifaStage | "none";

const TEAM_NAME_ALIASES: Record<string, string> = {
  BIH: "Bosnia and Herzegovina",
  CIV: "Côte d'Ivoire",
  COD: "Congo DR",
  CZE: "Czechia",
  IRN: "IR Iran",
  KOR: "Korea Republic",
  KSA: "Saudi Arabia",
  TUR: "Türkiye",
};

export function isFifaStage(value: string): value is FifaStage {
  return FIFA_STAGES.includes(value as FifaStage);
}

export function getFifaTeamFilter(country: { code: string; name: string }) {
  return TEAM_NAME_ALIASES[country.code] ?? country.name;
}

export function buildFifaFixturesUrl({
  stage,
  country,
}: {
  stage: FifaFixtureStage;
  country: { code: string; name: string };
}) {
  const params = new URLSearchParams({
    country: "",
    "wtw-filter": "ALL",
    stage,
    team: getFifaTeamFilter(country),
  });

  return `${FIFA_WORLD_CUP_2026_FIXTURES_URL}?${params.toString()}`;
}
