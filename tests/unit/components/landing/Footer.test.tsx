import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { Footer } from "@/components/landing/Footer";

describe("Footer", () => {
  beforeEach(() => {
    render(<Footer />);
  });

  it("summarizes the room experience", () => {
    expect(screen.getByText(/Create public or private World Cup rooms/i)).toBeInTheDocument();
  });

  it("does not show the old unsupported-payment disclaimer", () => {
    expect(screen.queryByText(/does not handle.*payments/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/wagering/i)).not.toBeInTheDocument();
  });

  it("renders the WinCup copyright line", () => {
    // Use getAllByText since "WinCup" appears in both disclaimer and copyright line
    const elements = screen.getAllByText(/WinCup/i);
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it("summary is visible (not aria-hidden)", () => {
    const summary = screen.getByText(/Create public or private World Cup rooms/i);
    expect(summary.closest('[aria-hidden="true"]')).toBeNull();
  });
});
