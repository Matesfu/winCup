import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import JoinRoomPage from "@/app/room/join/page";

jest.mock("@/actions/room", () => ({
  lookupRoomByCode: jest.fn(),
}));

jest.mock("react", () => {
  const actual = jest.requireActual("react");
  return {
    ...actual,
    useActionState: () => [null, jest.fn(), false],
  };
});

const mockUseRouter = useRouter as jest.Mock;

function mockHistoryLength(length: number) {
  Object.defineProperty(window.history, "length", {
    configurable: true,
    value: length,
  });
}

describe("JoinRoomPage", () => {
  const back = jest.fn();
  const push = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({
      back,
      push,
      replace: jest.fn(),
      forward: jest.fn(),
      prefetch: jest.fn(),
      refresh: jest.fn(),
    });
  });

  it("uses browser history when the back button has a previous page", () => {
    mockHistoryLength(2);

    render(<JoinRoomPage />);
    fireEvent.click(screen.getByRole("button", { name: /go back/i }));

    expect(back).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("falls back to Discover when there is no previous page", () => {
    mockHistoryLength(1);

    render(<JoinRoomPage />);
    fireEvent.click(screen.getByRole("button", { name: /go back/i }));

    expect(push).toHaveBeenCalledWith("/dashboard");
    expect(back).not.toHaveBeenCalled();
  });
});
