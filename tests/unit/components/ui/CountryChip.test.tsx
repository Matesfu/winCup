import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { CountryChip } from "@/components/ui/CountryChip";

const PROPS = { code: "ARG", name: "Argentina", flagEmoji: "🇦🇷" };

describe("CountryChip", () => {
  it("renders the flag emoji", () => {
    render(<CountryChip {...PROPS} />);
    expect(screen.getByText("🇦🇷")).toBeInTheDocument();
  });

  it("size='md' renders country name", () => {
    render(<CountryChip {...PROPS} size="md" />);
    expect(screen.getByText("Argentina")).toBeInTheDocument();
  });

  it("size='sm' does not render name text", () => {
    render(<CountryChip {...PROPS} size="sm" />);
    expect(screen.queryByText("Argentina")).not.toBeInTheDocument();
  });

  it("sm chip has the country name as aria-label", () => {
    render(<CountryChip {...PROPS} size="sm" />);
    expect(screen.getByLabelText("Argentina")).toBeInTheDocument();
  });

  it("has no interactive role (display-only)", () => {
    render(<CountryChip {...PROPS} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
