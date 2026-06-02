import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { GroupStatusCard } from "@/app/room/[id]/group-stage/_components/GroupStatusCard";
import type { Player } from "@/lib/types/database";

const BASE_PLAYER: Pick<Player, "id" | "name" | "avatar_emoji" | "assigned_country" | "is_eliminated"> = {
  id: "p1",
  name: "Alice",
  avatar_emoji: "🏆",
  assigned_country: "FRA",
  is_eliminated: false,
};

const COUNTRY = { code: "FRA", name: "France", flag_emoji: "🇫🇷" };

describe("GroupStatusCard", () => {
  it("renders player avatar emoji", () => {
    render(<GroupStatusCard player={BASE_PLAYER} country={COUNTRY} qualified={null} isCurrentUser={false} />);
    expect(screen.getByText("🏆")).toBeInTheDocument();
  });

  it("renders player name", () => {
    render(<GroupStatusCard player={BASE_PLAYER} country={COUNTRY} qualified={null} isCurrentUser={false} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders country flag and name", () => {
    render(<GroupStatusCard player={BASE_PLAYER} country={COUNTRY} qualified={null} isCurrentUser={false} />);
    expect(screen.getByTestId("status-card-flag")).toBeInTheDocument();
    expect(screen.getByText("France")).toBeInTheDocument();
  });

  it("qualified=true shows alive badge with ✓", () => {
    render(<GroupStatusCard player={BASE_PLAYER} country={COUNTRY} qualified={true} isCurrentUser={false} />);
    expect(screen.getByTestId("status-alive")).toBeInTheDocument();
  });

  it("qualified=false shows eliminated badge with ❌", () => {
    render(<GroupStatusCard player={BASE_PLAYER} country={COUNTRY} qualified={false} isCurrentUser={false} />);
    expect(screen.getByTestId("status-eliminated")).toBeInTheDocument();
  });

  it("qualified=null shows undecided status", () => {
    render(<GroupStatusCard player={BASE_PLAYER} country={COUNTRY} qualified={null} isCurrentUser={false} />);
    expect(screen.getByTestId("status-undecided")).toBeInTheDocument();
  });

  it("is_eliminated=true shows eliminated badge regardless of qualified", () => {
    const eliminatedPlayer = { ...BASE_PLAYER, is_eliminated: true };
    render(<GroupStatusCard player={eliminatedPlayer} country={COUNTRY} qualified={null} isCurrentUser={false} />);
    expect(screen.getByTestId("status-eliminated")).toBeInTheDocument();
  });

  it("current user card shows '(you)'", () => {
    render(<GroupStatusCard player={BASE_PLAYER} country={COUNTRY} qualified={null} isCurrentUser={true} />);
    expect(screen.getByText("(you)")).toBeInTheDocument();
  });

  it("non-current user card has no '(you)'", () => {
    render(<GroupStatusCard player={BASE_PLAYER} country={COUNTRY} qualified={null} isCurrentUser={false} />);
    expect(screen.queryByText("(you)")).not.toBeInTheDocument();
  });

  it("falls back gracefully when country is null", () => {
    render(<GroupStatusCard player={BASE_PLAYER} country={null} qualified={null} isCurrentUser={false} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });
});
