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

const COUNTRY = { code: "FRA", name: "France", flag_emoji: "🇫🇷", is_knocked_out: false };
const FIFA_STAGE = "Round of 32";

describe("GroupStatusCard", () => {
  it("renders player avatar emoji", () => {
    render(<GroupStatusCard player={BASE_PLAYER} country={COUNTRY} qualified={null} fifaStage={FIFA_STAGE} isCurrentUser={false} />);
    expect(screen.getByText("🏆")).toBeInTheDocument();
  });

  it("renders player name", () => {
    render(<GroupStatusCard player={BASE_PLAYER} country={COUNTRY} qualified={null} fifaStage={FIFA_STAGE} isCurrentUser={false} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders country flag and name", () => {
    render(<GroupStatusCard player={BASE_PLAYER} country={COUNTRY} qualified={null} fifaStage={FIFA_STAGE} isCurrentUser={false} />);
    expect(screen.getByTestId("status-card-flag")).toBeInTheDocument();
    expect(screen.getByText("France")).toBeInTheDocument();
  });

  it("qualified=true shows alive badge with ✓", () => {
    render(<GroupStatusCard player={BASE_PLAYER} country={COUNTRY} qualified={true} fifaStage={FIFA_STAGE} isCurrentUser={false} />);
    expect(screen.getByTestId("status-alive")).toBeInTheDocument();
    expect(screen.getByText("✓ Still in Cup")).toBeInTheDocument();
  });

  it("qualified=false shows eliminated badge with ❌", () => {
    render(<GroupStatusCard player={BASE_PLAYER} country={COUNTRY} qualified={false} fifaStage={FIFA_STAGE} isCurrentUser={false} />);
    expect(screen.getByTestId("status-eliminated")).toBeInTheDocument();
  });

  it("qualified=null shows alive status when the country is still in the cup", () => {
    render(<GroupStatusCard player={BASE_PLAYER} country={COUNTRY} qualified={null} fifaStage={FIFA_STAGE} isCurrentUser={false} />);
    expect(screen.getByTestId("status-alive")).toBeInTheDocument();
  });

  it("is_eliminated=true shows eliminated badge regardless of qualified", () => {
    const eliminatedPlayer = { ...BASE_PLAYER, is_eliminated: true };
    render(<GroupStatusCard player={eliminatedPlayer} country={COUNTRY} qualified={null} fifaStage={FIFA_STAGE} isCurrentUser={false} />);
    expect(screen.getByTestId("status-eliminated")).toBeInTheDocument();
  });

  it("current user card shows '(you)'", () => {
    render(<GroupStatusCard player={BASE_PLAYER} country={COUNTRY} qualified={null} fifaStage={FIFA_STAGE} isCurrentUser={true} />);
    expect(screen.getByText("(you)")).toBeInTheDocument();
  });

  it("non-current user card has no '(you)'", () => {
    render(<GroupStatusCard player={BASE_PLAYER} country={COUNTRY} qualified={null} fifaStage={FIFA_STAGE} isCurrentUser={false} />);
    expect(screen.queryByText("(you)")).not.toBeInTheDocument();
  });

  it("falls back gracefully when country is null", () => {
    render(<GroupStatusCard player={BASE_PLAYER} country={null} qualified={null} fifaStage={FIFA_STAGE} isCurrentUser={false} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByTestId("status-undecided")).toBeInTheDocument();
  });

  it("links to FIFA matches for the selected stage and country", () => {
    render(<GroupStatusCard player={BASE_PLAYER} country={COUNTRY} qualified={null} fifaStage={FIFA_STAGE} isCurrentUser={false} />);
    const link = screen.getByTestId("match-result-link");
    expect(link).toHaveTextContent("Match and result");
    expect(link).toHaveAttribute(
      "href",
      "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures?country=&wtw-filter=ALL&stage=Round+of+32&team=France"
    );
  });

  it("uses stage=none for globally knocked-out country links", () => {
    render(
      <GroupStatusCard
        player={BASE_PLAYER}
        country={{ ...COUNTRY, code: "ARG", name: "Argentina", is_knocked_out: true }}
        qualified={true}
        fifaStage={FIFA_STAGE}
        isCurrentUser={false}
      />
    );

    expect(screen.getByTestId("status-eliminated")).toBeInTheDocument();
    expect(screen.getByTestId("match-result-link")).toHaveAttribute(
      "href",
      "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures?country=&wtw-filter=ALL&stage=none&team=Argentina"
    );
  });
});
