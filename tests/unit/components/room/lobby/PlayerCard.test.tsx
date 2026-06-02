import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { PlayerCard } from "@/app/room/[id]/lobby/_components/PlayerCard";
import type { Player } from "@/lib/types/database";

const BASE_PLAYER: Player = {
  id: "player-1",
  room_id: "room-1",
  user_id: "user-1",
  name: "Alice",
  avatar_emoji: "🏆",
  assigned_country: null,
  is_eliminated: false,
  joined_at: new Date().toISOString(),
};

describe("PlayerCard", () => {
  it("renders the player avatar emoji", () => {
    render(<PlayerCard player={BASE_PLAYER} isHost={false} isCurrentUser={false} />);
    expect(screen.getByText("🏆")).toBeInTheDocument();
  });

  it("renders the player name", () => {
    render(<PlayerCard player={BASE_PLAYER} isHost={false} isCurrentUser={false} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("host card shows 'HOST' badge", () => {
    render(<PlayerCard player={BASE_PLAYER} isHost={true} isCurrentUser={false} />);
    expect(screen.getByTestId("host-badge")).toBeInTheDocument();
    expect(screen.getByTestId("host-badge")).toHaveTextContent("HOST");
  });

  it("non-host card has no HOST badge", () => {
    render(<PlayerCard player={BASE_PLAYER} isHost={false} isCurrentUser={false} />);
    expect(screen.queryByTestId("host-badge")).not.toBeInTheDocument();
  });

  it("current user's card shows '(you)'", () => {
    render(<PlayerCard player={BASE_PLAYER} isHost={false} isCurrentUser={true} />);
    expect(screen.getByText("(you)")).toBeInTheDocument();
  });

  it("non-current-user card has no '(you)'", () => {
    render(<PlayerCard player={BASE_PLAYER} isHost={false} isCurrentUser={false} />);
    expect(screen.queryByText("(you)")).not.toBeInTheDocument();
  });

  it("falls back to 👤 when avatar_emoji is null", () => {
    const player = { ...BASE_PLAYER, avatar_emoji: null };
    render(<PlayerCard player={player} isHost={false} isCurrentUser={false} />);
    expect(screen.getByText("👤")).toBeInTheDocument();
  });
});
