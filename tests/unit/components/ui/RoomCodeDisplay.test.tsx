import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { RoomCodeDisplay } from "@/components/ui/RoomCodeDisplay";

// Mock clipboard API
const mockWriteText = jest.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: mockWriteText },
  configurable: true,
});

describe("RoomCodeDisplay", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders the room code", () => {
    render(<RoomCodeDisplay code="WC-AB23" />);
    expect(screen.getByTestId("room-code-text")).toHaveTextContent("WC-AB23");
  });

  it("copy button has accessible aria-label", () => {
    render(<RoomCodeDisplay code="WC-AB23" />);
    expect(screen.getByRole("button", { name: /copy room code/i })).toBeInTheDocument();
  });

  it("clicking copy calls navigator.clipboard.writeText with the code", async () => {
    render(<RoomCodeDisplay code="WC-AB23" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /copy room code/i }));
    });
    expect(mockWriteText).toHaveBeenCalledWith("WC-AB23");
  });

  it("shows 'Copied!' feedback after clicking copy", async () => {
    render(<RoomCodeDisplay code="WC-AB23" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /copy room code/i }));
    });
    await waitFor(() => {
      expect(screen.getByText("Copied!")).toBeInTheDocument();
    });
  });
});
