import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoomChatLauncher } from "@/app/room/[id]/_components/RoomChatLauncher";
import type { RoomMessage } from "@/lib/types/database";

const mockSubscribeRoomMessages = jest.fn();

jest.mock("@/lib/supabase/realtime", () => ({
  subscribeRoomMessages: (...args: unknown[]) => mockSubscribeRoomMessages(...args),
}));

function makeMessage(overrides: Partial<RoomMessage> = {}): RoomMessage {
  return {
    id: "message-1",
    room_id: "room-1",
    sender_user_id: "user-2",
    sender_player_id: "player-2",
    sender_name: "Test Player",
    sender_avatar_emoji: "⚽",
    body: "Hello room",
    created_at: "2026-06-09T10:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function mockFetchResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: async () => body,
  } as Response);
}

describe("RoomChatLauncher", () => {
  const unsubscribe = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockSubscribeRoomMessages.mockReturnValue(unsubscribe);
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        callback(0);
        return 0;
      },
    });
    global.fetch = jest.fn();
  });

  it("does not fetch message history until the drawer opens", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse({ messages: [makeMessage()], hasMore: false })
    );

    render(<RoomChatLauncher roomId="room-1" currentUserId="user-1" />);

    expect(global.fetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /open room chat/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/rooms/room-1/messages?limit=50",
        { cache: "no-store" }
      );
    });
    expect(await screen.findByText("Hello room")).toBeInTheDocument();
  });

  it("increments unread count for incoming messages while closed", () => {
    render(<RoomChatLauncher roomId="room-1" currentUserId="user-1" />);

    const callbacks = mockSubscribeRoomMessages.mock.calls[0][1] as {
      onInserted: (message: RoomMessage) => void;
    };

    act(() => {
      callbacks.onInserted(makeMessage());
    });

    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("patches and removes messages from realtime update/delete events", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse({ messages: [makeMessage()], hasMore: false })
    );

    render(<RoomChatLauncher roomId="room-1" currentUserId="user-1" />);
    fireEvent.click(screen.getByRole("button", { name: /open room chat/i }));
    expect(await screen.findByText("Hello room")).toBeInTheDocument();

    const callbacks = mockSubscribeRoomMessages.mock.calls[0][1] as {
      onUpdated: (message: Partial<RoomMessage>) => void;
      onDeleted: (messageId: string) => void;
    };

    act(() => {
      callbacks.onUpdated({ id: "message-1", body: "Edited message" });
    });

    expect(screen.getByText("Edited message")).toBeInTheDocument();
    expect(screen.queryByText("Hello room")).not.toBeInTheDocument();

    act(() => {
      callbacks.onDeleted("message-1");
    });

    expect(screen.queryByText("Edited message")).not.toBeInTheDocument();
  });

  it("sends messages through the room message API", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockFetchResponse({ messages: [], hasMore: false }))
      .mockResolvedValueOnce(
        mockFetchResponse(
          {
            message: makeMessage({
              id: "message-2",
              sender_user_id: "user-1",
              sender_name: "Me",
              body: "Good luck",
            }),
          },
          true,
          201
        )
      );

    render(<RoomChatLauncher roomId="room-1" currentUserId="user-1" />);
    await user.click(screen.getByRole("button", { name: /open room chat/i }));
    expect(await screen.findByText("No messages yet")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/message the room/i), "Good luck");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith("/api/rooms/room-1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "Good luck" }),
      });
    });
    expect(await screen.findByText("Good luck")).toBeInTheDocument();
  });
});
