import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { LobbyProgress } from "@/app/room/[id]/lobby/_components/LobbyProgress";

describe("LobbyProgress", () => {
  it("renders 'X of Y players joined' text", () => {
    render(<LobbyProgress joined={3} total={6} />);
    expect(screen.getByText(/3 of 6 players joined/i)).toBeInTheDocument();
  });

  it("shows counter in X/Y format", () => {
    render(<LobbyProgress joined={3} total={6} />);
    expect(screen.getByText("3/6")).toBeInTheDocument();
  });

  it("shows completion message when joined === total", () => {
    render(<LobbyProgress joined={6} total={6} />);
    expect(screen.getByText(/ready to draw/i)).toBeInTheDocument();
  });

  it("progress bar aria-valuenow matches joined count", () => {
    render(<LobbyProgress joined={3} total={6} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
  });

  it("progress bar aria-valuemax matches total", () => {
    render(<LobbyProgress joined={3} total={6} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "6");
  });

  it("progress bar width is 50% for 3/6", () => {
    render(<LobbyProgress joined={3} total={6} />);
    expect(screen.getByTestId("progress-bar")).toHaveStyle({ width: "50%" });
  });

  it("progress bar is 100% when full", () => {
    render(<LobbyProgress joined={6} total={6} />);
    expect(screen.getByTestId("progress-bar")).toHaveStyle({ width: "100%" });
  });
});
