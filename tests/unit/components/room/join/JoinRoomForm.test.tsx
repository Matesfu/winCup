import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("@/actions/room", () => ({
  joinRoom: jest.fn(),
}));

jest.mock("react", () => {
  const actual = jest.requireActual("react");
  return {
    ...actual,
    useActionState: (
      action: (prevState: unknown, formData: FormData) => Promise<unknown>,
      initial: unknown
    ) => {
      return [initial, (fd: FormData) => action(initial, fd), false];
    },
  };
});

import { JoinRoomForm } from "@/app/room/[id]/join/_components/JoinRoomForm";

const COUNTRIES = [
  { code: "ARG", name: "Argentina", flag_emoji: "🇦🇷", is_knocked_out: false, is_taken: false },
  { code: "BRA", name: "Brazil", flag_emoji: "🇧🇷", is_knocked_out: false, is_taken: true },
  { code: "FRA", name: "France", flag_emoji: "🇫🇷", is_knocked_out: true, is_taken: false },
];

describe("JoinRoomForm", () => {
  beforeEach(() => jest.clearAllMocks());

  it("does not require a country in random mode", () => {
    render(
      <JoinRoomForm
        roomId="room-1"
        defaultName="Alice"
        assignmentMode="random"
        countries={COUNTRIES}
      />
    );

    expect(screen.queryByLabelText("Choose your country")).not.toBeInTheDocument();
    expect(screen.getByTestId("join-room-submit")).not.toBeDisabled();
  });

  it("requires an available country in player-choice mode", () => {
    render(
      <JoinRoomForm
        roomId="room-1"
        defaultName="Alice"
        assignmentMode="player_choice"
        countries={COUNTRIES}
      />
    );

    expect(screen.getByTestId("join-room-submit")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Choose your country"), {
      target: { value: "ARG" },
    });
    expect(screen.getByTestId("join-room-submit")).not.toBeDisabled();
  });

  it("marks taken and knocked-out countries as disabled options", () => {
    render(
      <JoinRoomForm
        roomId="room-1"
        defaultName="Alice"
        assignmentMode="player_choice"
        countries={COUNTRIES}
      />
    );

    expect(screen.getByRole("option", { name: /Brazil.*taken/i })).toBeDisabled();
    expect(screen.getByRole("option", { name: /France.*out/i })).toBeDisabled();
  });
});
