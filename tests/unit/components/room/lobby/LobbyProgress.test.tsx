import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { LobbyProgress } from "@/app/room/[id]/lobby/_components/LobbyProgress";

describe("LobbyProgress", () => {
  it("renders random mode joined text", () => {
    render(
      <LobbyProgress
        joined={3}
        total={6}
        assignmentMode="random"
        chosen={0}
        isReady={false}
      />
    );
    expect(screen.getByText(/3 players joined from 6 available countries/i)).toBeInTheDocument();
  });

  it("shows counter in X/Y format", () => {
    render(
      <LobbyProgress
        joined={3}
        total={6}
        assignmentMode="random"
        chosen={0}
        isReady={false}
      />
    );
    expect(screen.getByText("3/6")).toBeInTheDocument();
  });

  it("shows random ready message without requiring all countries to be used", () => {
    render(
      <LobbyProgress
        joined={3}
        total={6}
        assignmentMode="random"
        chosen={0}
        isReady={true}
      />
    );
    expect(screen.getByText(/ready to draw/i)).toBeInTheDocument();
  });

  it("progress bar aria-valuenow matches joined count", () => {
    render(
      <LobbyProgress
        joined={3}
        total={6}
        assignmentMode="random"
        chosen={0}
        isReady={false}
      />
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
  });

  it("progress bar aria-valuemax matches total", () => {
    render(
      <LobbyProgress
        joined={3}
        total={6}
        assignmentMode="random"
        chosen={0}
        isReady={false}
      />
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "6");
  });

  it("progress bar width is 50% for 3/6", () => {
    render(
      <LobbyProgress
        joined={3}
        total={6}
        assignmentMode="random"
        chosen={0}
        isReady={false}
      />
    );
    expect(screen.getByTestId("progress-bar")).toHaveStyle({ width: "50%" });
  });

  it("uses chosen countries for player-choice progress", () => {
    render(
      <LobbyProgress
        joined={3}
        total={6}
        assignmentMode="player_choice"
        chosen={2}
        isReady={false}
      />
    );
    expect(screen.getByText(/2 of 6 countries chosen/i)).toBeInTheDocument();
    expect(screen.getByText("2/6")).toBeInTheDocument();
    expect(screen.getByTestId("progress-bar")).toHaveStyle({ width: "33.33333333333333%" });
  });

  it("progress bar is 100% when progress reaches total", () => {
    render(
      <LobbyProgress
        joined={6}
        total={6}
        assignmentMode="random"
        chosen={0}
        isReady={true}
      />
    );
    expect(screen.getByTestId("progress-bar")).toHaveStyle({ width: "100%" });
  });
});
