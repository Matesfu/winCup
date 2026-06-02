import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

jest.mock("@/actions/room", () => ({
  advanceMatch: jest.fn(),
}));

jest.mock("react", () => {
  const actual = jest.requireActual("react");
  return {
    ...actual,
    useActionState: (action: unknown, initial: unknown) => [initial, action, false],
  };
});

import { MatchCard } from "@/app/room/[id]/ladder/_components/MatchCard";
import type { BracketMatchup } from "@/lib/bracket";

const COUNTRIES = new Map([
  ["ARG", { code: "ARG", name: "Argentina", flag_emoji: "🇦🇷" }],
  ["BRA", { code: "BRA", name: "Brazil", flag_emoji: "🇧🇷" }],
]);

const PLAYERS = new Map([
  ["p1", { id: "p1", name: "Alice", avatar_emoji: "🏆" }],
]);

function makeMatchup(overrides: Partial<BracketMatchup> = {}): BracketMatchup {
  return {
    stage: "qf",
    matchOrder: 1,
    slotA: { teamCode: "ARG", playerId: "p1", playerName: null, isEliminated: false, isChampion: false, bracketPosition: 1 },
    slotB: { teamCode: "BRA", playerId: null, playerName: null, isEliminated: false, isChampion: false, bracketPosition: 2 },
    winnerCode: null,
    externalMatchId: null,
    ...overrides,
  };
}

const BASE_PROPS = {
  roomId: "room-1",
  isHost: false,
  currentUserId: "u1",
  countriesMap: COUNTRIES,
  playersMap: PLAYERS,
};

describe("MatchCard", () => {
  it("renders both team slots", () => {
    render(<MatchCard matchup={makeMatchup()} {...BASE_PROPS} />);
    // Both teams should be in the DOM
    expect(screen.getAllByTestId(/team-slot/)).toHaveLength(2);
  });

  it("shows winner styling when winner is decided", () => {
    const matchup = makeMatchup({ winnerCode: "ARG" });
    render(<MatchCard matchup={matchup} {...BASE_PROPS} />);
    const winner = screen.getAllByTestId("team-slot-active").find(
      (el) => el.getAttribute("data-state") === "winner"
    );
    expect(winner).toBeTruthy();
  });

  it("non-host sees no override buttons", () => {
    render(<MatchCard matchup={makeMatchup()} {...BASE_PROPS} isHost={false} />);
    expect(screen.queryByTestId("advance-ARG")).not.toBeInTheDocument();
    expect(screen.queryByTestId("advance-BRA")).not.toBeInTheDocument();
  });

  it("host sees override buttons when match undecided and both teams known", () => {
    render(<MatchCard matchup={makeMatchup()} {...BASE_PROPS} isHost={true} />);
    expect(screen.getByTestId("advance-ARG")).toBeInTheDocument();
    expect(screen.getByTestId("advance-BRA")).toBeInTheDocument();
  });

  it("host sees no override buttons when winner already decided", () => {
    const matchup = makeMatchup({ winnerCode: "ARG" });
    render(<MatchCard matchup={matchup} {...BASE_PROPS} isHost={true} />);
    expect(screen.queryByTestId("advance-ARG")).not.toBeInTheDocument();
  });

  it("host sees no override when either team is TBD", () => {
    const matchup = makeMatchup({ slotB: { ...makeMatchup().slotB, teamCode: null } });
    render(<MatchCard matchup={matchup} {...BASE_PROPS} isHost={true} />);
    expect(screen.queryByTestId("advance-ARG")).not.toBeInTheDocument();
  });
});
