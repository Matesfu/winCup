import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { MobileBottomNav } from "@/components/app/MobileBottomNav";

describe("MobileBottomNav", () => {
  beforeEach(() => {
    (usePathname as jest.Mock).mockReturnValue("/my-rooms");
  });

  it("renders the primary app navigation links", () => {
    render(<MobileBottomNav />);

    expect(screen.getByRole("navigation", { name: /primary/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /discover/i })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: /my rooms/i })).toHaveAttribute("href", "/my-rooms");
    expect(screen.getByRole("link", { name: /create/i })).toHaveAttribute("href", "/room/create");
    expect(screen.getByRole("link", { name: /join/i })).toHaveAttribute("href", "/room/join");
    expect(screen.getByRole("link", { name: /profile/i })).toHaveAttribute("href", "/profile");
  });

  it("marks the active route", () => {
    render(<MobileBottomNav />);

    expect(screen.getByRole("link", { name: /my rooms/i })).toHaveAttribute("aria-current", "page");
  });
});
