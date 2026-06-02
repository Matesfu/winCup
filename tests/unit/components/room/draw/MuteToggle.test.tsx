import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { MuteToggle } from "@/app/room/[id]/draw/_components/MuteToggle";

jest.mock("@/lib/sound", () => ({
  resumeAudio: jest.fn(),
}));

describe("MuteToggle", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows unmuted icon (🔊) when not muted", () => {
    render(<MuteToggle muted={false} onToggle={jest.fn()} />);
    expect(screen.getByText("🔊")).toBeInTheDocument();
  });

  it("shows muted icon (🔇) when muted", () => {
    render(<MuteToggle muted={true} onToggle={jest.fn()} />);
    expect(screen.getByText("🔇")).toBeInTheDocument();
  });

  it("has aria-label 'Mute sound' when not muted", () => {
    render(<MuteToggle muted={false} onToggle={jest.fn()} />);
    expect(screen.getByRole("button", { name: /mute sound/i })).toBeInTheDocument();
  });

  it("has aria-label 'Unmute sound' when muted", () => {
    render(<MuteToggle muted={true} onToggle={jest.fn()} />);
    expect(screen.getByRole("button", { name: /unmute sound/i })).toBeInTheDocument();
  });

  it("calls onToggle when clicked", () => {
    const onToggle = jest.fn();
    render(<MuteToggle muted={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByTestId("mute-toggle"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("calls resumeAudio when clicked", async () => {
    const { resumeAudio } = await import("@/lib/sound");
    render(<MuteToggle muted={false} onToggle={jest.fn()} />);
    fireEvent.click(screen.getByTestId("mute-toggle"));
    expect(resumeAudio).toHaveBeenCalledTimes(1);
  });
});
