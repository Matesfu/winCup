import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { CountryCard } from "@/app/room/create/_components/CountryCard";

const PROPS = {
  code: "ARG",
  name: "Argentina",
  flagEmoji: "🇦🇷",
  selected: false,
  onToggle: jest.fn(),
};

describe("CountryCard", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders flag emoji and country name", () => {
    render(<CountryCard {...PROPS} />);
    expect(screen.getByText("🇦🇷")).toBeInTheDocument();
    expect(screen.getByText("Argentina")).toBeInTheDocument();
  });

  it("unselected: aria-checked is false", () => {
    render(<CountryCard {...PROPS} selected={false} />);
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "false");
  });

  it("selected: aria-checked is true", () => {
    render(<CountryCard {...PROPS} selected={true} />);
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
  });

  it("calls onToggle with the country code on click", () => {
    render(<CountryCard {...PROPS} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(PROPS.onToggle).toHaveBeenCalledWith("ARG");
    expect(PROPS.onToggle).toHaveBeenCalledTimes(1);
  });

  it("shows a checkmark when selected", () => {
    render(<CountryCard {...PROPS} selected={true} />);
    expect(screen.getByText("✓")).toBeInTheDocument();
  });

  it("does not show checkmark when unselected", () => {
    render(<CountryCard {...PROPS} selected={false} />);
    expect(screen.queryByText("✓")).not.toBeInTheDocument();
  });

  it("is disabled when disabled=true", () => {
    render(<CountryCard {...PROPS} disabled={true} />);
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("is disabled and does not toggle when knocked out", () => {
    render(<CountryCard {...PROPS} knockedOut={true} />);
    const card = screen.getByRole("checkbox", {
      name: "Argentina is knocked out and cannot be selected",
    });

    expect(card).toBeDisabled();
    expect(screen.getByText("Out")).toBeInTheDocument();
    fireEvent.click(card);
    expect(PROPS.onToggle).not.toHaveBeenCalled();
  });
});
