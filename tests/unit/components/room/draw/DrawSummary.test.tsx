import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { DrawSummary } from "@/app/room/[id]/draw/_components/DrawSummary";

const PLAYERS = [
  {
    id: "p1",
    name: "Alice",
    avatar_emoji: "🏆",
    assigned_country: "ARG",
    user_id: "u1",
  },
  {
    id: "p2",
    name: "Bob",
    avatar_emoji: "⚽",
    assigned_country: "BRA",
    user_id: "u2",
  },
  {
    id: "p3",
    name: "Carol",
    avatar_emoji: "🦁",
    assigned_country: "FRA",
    user_id: "u3",
  },
];

const COUNTRIES_MAP = new Map([
  ["ARG", { code: "ARG", name: "Argentina", flag_emoji: "🇦🇷" }],
  ["BRA", { code: "BRA", name: "Brazil", flag_emoji: "🇧🇷" }],
  ["FRA", { code: "FRA", name: "France", flag_emoji: "🇫🇷" }],
]);

describe("DrawSummary", () => {
  beforeEach(() => {
    render(
      <DrawSummary
        roomId="room-123"
        players={PLAYERS}
        countriesMap={COUNTRIES_MAP}
        isHost={false}
      />
    );
  });

  it("renders a 'Draw is Complete' heading", () => {
    expect(screen.getByText(/The Draw is Complete/i)).toBeInTheDocument();
  });

  it("renders one card per player", () => {
    const cards = screen.getAllByTestId("summary-player-card");
    expect(cards).toHaveLength(PLAYERS.length);
  });

  it("renders each player's avatar emoji", () => {
    // 🏆 also appears in the page header, so use getAllByText
    expect(screen.getAllByText("🏆").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("⚽")).toBeInTheDocument();
    expect(screen.getByText("🦁")).toBeInTheDocument();
  });

  it("renders each player's name", () => {
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Carol")).toBeInTheDocument();
  });

  it("renders each assigned country name", () => {
    expect(screen.getByText("Argentina")).toBeInTheDocument();
    expect(screen.getByText("Brazil")).toBeInTheDocument();
    expect(screen.getByText("France")).toBeInTheDocument();
  });

  it("renders the country flag emojis", () => {
    expect(screen.getAllByTestId("summary-country-flag")).toHaveLength(PLAYERS.length);
  });

  it("renders the 'Go to Group Stage' link", () => {
    expect(screen.getByTestId("go-to-group-stage")).toBeInTheDocument();
  });

  it("'Go to Group Stage' href contains /group-stage", () => {
    const link = screen.getByTestId("go-to-group-stage");
    expect(link).toHaveAttribute("href", expect.stringContaining("group-stage"));
  });
});
