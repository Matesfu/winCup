import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { TeamSlot } from "@/app/room/[id]/ladder/_components/TeamSlot";
import type { BracketSlot } from "@/lib/bracket";

const COUNTRY = { code: "ARG", name: "Argentina", flag_emoji: "🇦🇷" };
const PLAYER = { id: "p1", name: "Alice", avatar_emoji: "🏆" };

function makeSlot(overrides: Partial<BracketSlot> = {}): BracketSlot {
  return {
    teamCode: "ARG",
    playerId: null,
    playerName: null,
    isEliminated: false,
    isChampion: false,
    bracketPosition: 1,
    ...overrides,
  };
}

describe("TeamSlot", () => {
  it("renders TBD when teamCode is null", () => {
    render(<TeamSlot slot={makeSlot({ teamCode: null })} country={null} player={null} isWinner={false} isCurrentUser={false} />);
    expect(screen.getByTestId("team-slot-tbd")).toBeInTheDocument();
    expect(screen.getByText("TBD")).toBeInTheDocument();
  });

  it("renders player name for player-owned teams", () => {
    render(<TeamSlot slot={makeSlot({ playerId: "p1" })} country={COUNTRY} player={PLAYER} isWinner={false} isCurrentUser={false} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders country flag emoji", () => {
    render(<TeamSlot slot={makeSlot()} country={COUNTRY} player={null} isWinner={false} isCurrentUser={false} />);
    expect(screen.getByText("🇦🇷")).toBeInTheDocument();
  });

  it("renders country name", () => {
    render(<TeamSlot slot={makeSlot()} country={COUNTRY} player={null} isWinner={false} isCurrentUser={false} />);
    expect(screen.getByText("Argentina")).toBeInTheDocument();
  });

  it("filler team: shows flag but no player name", () => {
    render(<TeamSlot slot={makeSlot({ playerId: null })} country={COUNTRY} player={null} isWinner={false} isCurrentUser={false} />);
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    expect(screen.getByText("🇦🇷")).toBeInTheDocument();
  });

  it("winner has winner data-state", () => {
    render(<TeamSlot slot={makeSlot()} country={COUNTRY} player={null} isWinner={true} isCurrentUser={false} />);
    expect(screen.getByTestId("team-slot-active")).toHaveAttribute("data-state", "winner");
  });

  it("eliminated team has eliminated data-state", () => {
    render(<TeamSlot slot={makeSlot({ isEliminated: true })} country={COUNTRY} player={null} isWinner={false} isCurrentUser={false} />);
    expect(screen.getByTestId("team-slot-eliminated")).toBeInTheDocument();
    expect(screen.getByText("❌")).toBeInTheDocument();
  });

  it("champion renders 🏆", () => {
    render(<TeamSlot slot={makeSlot({ isChampion: true })} country={COUNTRY} player={PLAYER} isWinner={false} isCurrentUser={false} />);
    expect(screen.getByTestId("team-slot-champion")).toBeInTheDocument();
    expect(screen.getByText("🏆")).toBeInTheDocument();
  });
});
