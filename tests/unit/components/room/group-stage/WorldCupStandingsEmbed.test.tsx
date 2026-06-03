import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { WorldCupStandingsEmbed } from "@/app/room/[id]/group-stage/_components/WorldCupStandingsEmbed";

describe("WorldCupStandingsEmbed", () => {
  it("keeps the official FIFA fixtures link", () => {
    render(<WorldCupStandingsEmbed fifaStage="First Stage" />);

    const link = screen.getByRole("link", { name: /Open official page/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("href")).toContain("scores-fixtures");
    expect(link.getAttribute("href")).toContain("stage=First+Stage");
  });

  it("does not render the old iframe-blocked explanation", () => {
    render(<WorldCupStandingsEmbed fifaStage="First Stage" />);

    expect(screen.queryByText(/FIFA blocks third-party iframe display/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/fixtures on FIFA.com/i)).not.toBeInTheDocument();
  });
});
