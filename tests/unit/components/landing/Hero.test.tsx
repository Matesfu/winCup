import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { Hero } from "@/components/landing/Hero";

describe("Hero", () => {
  beforeEach(() => {
    render(<Hero />);
  });

  it('renders the "WinCup" heading', () => {
    expect(
      screen.getByRole("heading", { name: /WinCup/i })
    ).toBeInTheDocument();
  });

  it("renders the tagline", () => {
    expect(screen.getByText(/Pick a country/i)).toBeInTheDocument();
    expect(screen.getByText(/One winner takes it all/i)).toBeInTheDocument();
  });

  it('renders a "Create Room" link pointing to /room/create', () => {
    const link = screen.getByRole("link", { name: /Create Room/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/room/create");
  });

  it('renders a "Join Room" link pointing to /room/join', () => {
    const link = screen.getByRole("link", { name: /Join Room/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/room/join");
  });

  it("does not render broken or undefined hrefs", () => {
    const links = screen.getAllByRole("link");
    for (const link of links) {
      const href = link.getAttribute("href");
      expect(href).toBeTruthy();
      expect(href).not.toBe("#");
      expect(href).not.toBe("undefined");
    }
  });
});
