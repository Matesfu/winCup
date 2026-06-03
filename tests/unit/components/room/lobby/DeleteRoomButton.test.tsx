import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("@/actions/room", () => ({
  deleteRoom: jest.fn(),
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

import { DeleteRoomButton } from "@/app/room/[id]/lobby/_components/DeleteRoomButton";

describe("DeleteRoomButton", () => {
  it("shows a caution panel before exposing the final delete action", () => {
    render(<DeleteRoomButton roomId="room-1" roomName="Friday room" />);

    fireEvent.click(screen.getByTestId("open-delete-room-confirmation"));

    expect(screen.getByTestId("delete-room-confirmation")).toBeInTheDocument();
    expect(screen.getByText(/Delete this waiting room/i)).toBeInTheDocument();
    expect(screen.getByText(/permanently removes/i)).toBeInTheDocument();
    expect(screen.getByTestId("confirm-delete-room")).toHaveTextContent(/Yes, delete room/i);
  });

  it("keeps the room id in the delete form", () => {
    render(<DeleteRoomButton roomId="room-1" roomName="Friday room" />);

    fireEvent.click(screen.getByTestId("open-delete-room-confirmation"));

    const roomInput = document.querySelector<HTMLInputElement>('input[name="roomId"]');
    expect(roomInput?.value).toBe("room-1");
  });

  it("can cancel the delete confirmation", () => {
    render(<DeleteRoomButton roomId="room-1" roomName="Friday room" />);

    fireEvent.click(screen.getByTestId("open-delete-room-confirmation"));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByTestId("delete-room-confirmation")).not.toBeInTheDocument();
    expect(screen.getByTestId("open-delete-room-confirmation")).toBeInTheDocument();
  });
});
