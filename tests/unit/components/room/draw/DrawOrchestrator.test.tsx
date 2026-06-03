import "@testing-library/jest-dom";
import { act, render } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { DrawOrchestrator } from "@/app/room/[id]/draw/_components/DrawOrchestrator";
import { subscribeRoomUpdates } from "@/lib/supabase/realtime";

jest.mock("@/lib/supabase/realtime", () => ({
  subscribeRoomUpdates: jest.fn(),
}));

const PLAYERS = [
  {
    id: "p1",
    name: "Alice",
    avatar_emoji: "🏆",
    assigned_country: "ARG",
  },
];

const COUNTRIES = [
  { code: "ARG", name: "Argentina", flag_emoji: "🇦🇷" },
];

describe("DrawOrchestrator", () => {
  const replace = jest.fn();
  const push = jest.fn();
  const unsubscribe = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push,
      replace,
      back: jest.fn(),
      forward: jest.fn(),
      prefetch: jest.fn(),
      refresh: jest.fn(),
    });
    (subscribeRoomUpdates as jest.Mock).mockReturnValue(unsubscribe);
  });

  it("replaces history when realtime moves the room to group stage", () => {
    render(
      <DrawOrchestrator
        roomId="room-1"
        players={PLAYERS}
        countries={COUNTRIES}
        allAssigned
      />
    );

    const onUpdate = (subscribeRoomUpdates as jest.Mock).mock.calls[0][1];

    act(() => {
      onUpdate({ status: "group_stage" });
    });

    expect(replace).toHaveBeenCalledWith("/room/room-1/group-stage");
    expect(push).not.toHaveBeenCalled();
  });
});
