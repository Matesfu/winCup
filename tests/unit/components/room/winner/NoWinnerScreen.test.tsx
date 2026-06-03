import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { NoWinnerScreen } from "@/app/room/[id]/winner/_components/NoWinnerScreen";

const BASE_PROPS = {
  championCountryName: "Argentina",
  championCountryFlag: "🇦🇷",
  stakeAmount: 10,
};

describe("NoWinnerScreen", () => {
  beforeEach(() => {
    render(<NoWinnerScreen {...BASE_PROPS} />);
  });

  it("renders 'No Winner' heading", () => {
    expect(screen.getByTestId("no-winner-heading")).toHaveTextContent("No Winner");
  });

  it("shows the stakes-returned message", () => {
    expect(screen.getByTestId("no-winner-message")).toHaveTextContent(/stakes returned/i);
  });

  it("shows the actual champion country name", () => {
    expect(screen.getByTestId("champion-country-name")).toHaveTextContent("Argentina");
  });

  it("shows the actual champion country flag", () => {
    expect(screen.getByTestId("champion-country-flag")).toHaveTextContent("🇦🇷");
  });

  it("renders 'Start New Room' link to /room/create", () => {
    const link = screen.getByTestId("start-new-room");
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toBe("/room/create");
  });

  it("renders WhatsApp share button", () => {
    expect(screen.getByTestId("whatsapp-share")).toBeInTheDocument();
  });
});

describe("NoWinnerScreen — with stake amount", () => {
  it("shows stake amount note when stakeAmount is non-null", () => {
    render(<NoWinnerScreen {...BASE_PROPS} stakeAmount={20} />);
    expect(screen.getByText(/20 Birr/)).toBeInTheDocument();
    // "Stakes returned" appears in both the message and the stake section — use getAllByText
    expect(screen.getAllByText(/stakes returned/i).length).toBeGreaterThanOrEqual(1);
  });

  it("no stake section when stakeAmount is null", () => {
    render(<NoWinnerScreen {...BASE_PROPS} stakeAmount={null} />);
    expect(screen.queryByText(/Birr/)).not.toBeInTheDocument();
  });
});
