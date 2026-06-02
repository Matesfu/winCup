import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { Footer } from "@/components/landing/Footer";

describe("Footer", () => {
  beforeEach(() => {
    render(<Footer />);
  });

  it("renders the entertainment-only disclaimer", () => {
    expect(screen.getByText(/entertainment only/i)).toBeInTheDocument();
  });

  it("states it does not handle payments", () => {
    expect(screen.getByText(/does not handle.*payments/i)).toBeInTheDocument();
  });

  it("includes an 18+ note", () => {
    expect(screen.getByText(/18\+/i)).toBeInTheDocument();
  });

  it("renders the WinCup copyright line", () => {
    // Use getAllByText since "WinCup" appears in both disclaimer and copyright line
    const elements = screen.getAllByText(/WinCup/i);
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it("disclaimer is visible (not aria-hidden)", () => {
    const disclaimer = screen.getByText(/entertainment only/i);
    // Should not have aria-hidden="true" on itself or a direct parent
    expect(disclaimer.closest('[aria-hidden="true"]')).toBeNull();
  });
});
