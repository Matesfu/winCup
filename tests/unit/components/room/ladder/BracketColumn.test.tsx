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

import { BracketColumn } from "@/app/room/[id]/ladder/_components/BracketColumn";
import type { BracketMatchup } from "@/lib/bracket";

function makeMatchup(stage: BracketMatchup["stage"], order: number): BracketMatchup {
  return {
    stage,
    matchOrder: order,
    slotA: { teamCode: `A${order}`, playerId: null, playerName: null, isEliminated: false, isChampion: false, bracketPosition: order * 2 - 1 },
    slotB: { teamCode: `B${order}`, playerId: null, playerName: null, isEliminated: false, isChampion: false, bracketPosition: order * 2 },
    winnerCode: null,
    externalMatchId: null,
  };
}

const BASE_PROPS = {
  roomId: "r1",
  isHost: false,
  currentUserId: "u1",
  countriesMap: new Map([
    ["A1", { code: "A1", name: "TeamA1", flag_emoji: "🇦🇷" }],
    ["B1", { code: "B1", name: "TeamB1", flag_emoji: "🇧🇷" }],
    ["A2", { code: "A2", name: "TeamA2", flag_emoji: "🇫🇷" }],
    ["B2", { code: "B2", name: "TeamB2", flag_emoji: "🇩🇪" }],
  ]),
  playersMap: new Map(),
};

describe("BracketColumn", () => {
  it("renders the stage heading", () => {
    render(
      <BracketColumn
        stage="qf"
        matchups={[makeMatchup("qf", 1), makeMatchup("qf", 2)]}
        {...BASE_PROPS}
      />
    );
    expect(screen.getByText("Quarter-finals")).toBeInTheDocument();
  });

  it("renders correct number of match cards for the stage", () => {
    const qfMatchups = [makeMatchup("qf", 1), makeMatchup("qf", 2)];
    const sfMatchups = [makeMatchup("sf", 1)];
    render(
      <BracketColumn
        stage="qf"
        matchups={[...qfMatchups, ...sfMatchups]}
        {...BASE_PROPS}
      />
    );
    // Only QF matchups should render (2 match cards)
    const cards = screen.getAllByTestId("match-card");
    expect(cards).toHaveLength(2);
  });

  it("renders column with correct data-testid", () => {
    render(
      <BracketColumn
        stage="sf"
        matchups={[makeMatchup("sf", 1)]}
        {...BASE_PROPS}
      />
    );
    expect(screen.getByTestId("bracket-column-sf")).toBeInTheDocument();
  });
});
