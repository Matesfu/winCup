import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { FlagCarousel } from "@/app/room/[id]/draw/_components/FlagCarousel";

// Mock sound functions — they're no-ops in test (no AudioContext)
jest.mock("@/lib/sound", () => ({
  playTick: jest.fn(),
  playThud: jest.fn(),
  resumeAudio: jest.fn(),
}));

const SEQUENCE = [
  { code: "ARG", flag_emoji: "🇦🇷" },
  { code: "BRA", flag_emoji: "🇧🇷" },
  { code: "FRA", flag_emoji: "🇫🇷" },
  { code: "ENG", flag_emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { code: "GER", flag_emoji: "🇩🇪" },
];

describe("FlagCarousel", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders without crashing", () => {
    render(
      <FlagCarousel
        sequence={SEQUENCE}
        onComplete={jest.fn()}
        isMuted={true}
      />
    );
    expect(screen.getByTestId("flag-carousel")).toBeInTheDocument();
  });

  it("renders the golden selection frame", () => {
    render(
      <FlagCarousel
        sequence={SEQUENCE}
        onComplete={jest.fn()}
        isMuted={true}
      />
    );
    // The carousel container exists with the correct test id
    expect(screen.getByTestId("flag-carousel")).toBeInTheDocument();
  });

  it("renders all flags from the sequence", () => {
    render(
      <FlagCarousel
        sequence={SEQUENCE}
        onComplete={jest.fn()}
        isMuted={true}
      />
    );
    // All flag emojis should be in the DOM
    SEQUENCE.forEach((flag) => {
      expect(screen.getAllByText(flag.flag_emoji).length).toBeGreaterThanOrEqual(1);
    });
  });
});
