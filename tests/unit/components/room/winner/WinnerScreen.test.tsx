import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { WinnerScreen } from "@/app/room/[id]/winner/_components/WinnerScreen";

const BASE_PROPS = {
  playerName: "Alice",
  playerAvatar: "🏆",
  countryName: "Argentina",
  countryFlag: "🇦🇷",
  stakeAmount: 10,
  winMessage: "Champion's owner wins the pot! 🏆",
  roomCode: "WC-AB23",
};

describe("WinnerScreen", () => {
  beforeEach(() => {
    render(<WinnerScreen {...BASE_PROPS} />);
  });

  it("renders 'WinCup Winner!' heading", () => {
    expect(screen.getByText("WinCup Winner!")).toBeInTheDocument();
  });

  it("renders the player name", () => {
    expect(screen.getByTestId("winner-player-name")).toHaveTextContent("Alice");
  });

  it("renders the country flag emoji", () => {
    expect(screen.getByTestId("winner-country-flag")).toHaveTextContent("🇦🇷");
  });

  it("renders the country name", () => {
    expect(screen.getByTestId("winner-country-name")).toHaveTextContent("Argentina");
  });

  it("renders the win message", () => {
    expect(screen.getByText(/Champion's owner wins/i)).toBeInTheDocument();
  });

  it("renders the WhatsApp share button", () => {
    expect(screen.getByTestId("whatsapp-share")).toBeInTheDocument();
  });

  it("WhatsApp href contains wa.me", () => {
    const link = screen.getByTestId("whatsapp-share");
    expect(link.getAttribute("href")).toContain("wa.me");
  });

  it("WhatsApp href includes player country name (encoded)", () => {
    const link = screen.getByTestId("whatsapp-share");
    const href = decodeURIComponent(link.getAttribute("href") ?? "");
    expect(href).toContain("Argentina");
  });

  it("renders 'Start New Room' link", () => {
    const link = screen.getByTestId("start-new-room");
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toBe("/room/create");
  });

  it("shows stake amount when non-null", () => {
    expect(screen.getByText("£10")).toBeInTheDocument();
  });
});

describe("WinnerScreen — no stake", () => {
  it("does not show stake section when stakeAmount is null", () => {
    render(<WinnerScreen {...BASE_PROPS} stakeAmount={null} />);
    expect(screen.queryByText(/£/)).not.toBeInTheDocument();
  });
});
