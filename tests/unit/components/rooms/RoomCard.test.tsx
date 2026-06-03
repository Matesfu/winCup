import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { RoomCard } from "@/components/rooms/RoomCard";
import type { RoomListItem } from "@/lib/room-list";

const BASE_ROOM: RoomListItem = {
  id: "room-1",
  code: "WC-ROOM",
  status: "lobby",
  host_user_id: "host-1",
  host_name: "Host",
  room_name: "Weekend Cup",
  visibility: "public",
  assignment_mode: "random",
  win_rule: "last_standing",
  stake_amount: 250,
  created_at: "2026-06-03T00:00:00.000Z",
  winner_player_id: null,
  playerCount: 2,
  countryCount: 8,
  userRole: "public",
};

describe("RoomCard", () => {
  it("renders public room details and routes to the join page", () => {
    render(<RoomCard room={BASE_ROOM} />);

    expect(screen.getByText("Weekend Cup")).toBeInTheDocument();
    expect(screen.getByText("250 Birr")).toBeInTheDocument();
    expect(screen.getByText("Public")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /join room/i })).toHaveAttribute(
      "href",
      "/room/room-1/join"
    );
  });

  it("routes hosted group-stage rooms to the active phase", () => {
    render(
      <RoomCard
        room={{
          ...BASE_ROOM,
          status: "group_stage",
          userRole: "host",
        }}
      />
    );

    expect(screen.getByText("Host")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /enter room/i })).toHaveAttribute(
      "href",
      "/room/room-1/group-stage"
    );
  });

  it("shows View Results for finished rooms", () => {
    render(
      <RoomCard
        room={{
          ...BASE_ROOM,
          status: "finished",
          userRole: "player",
          winner_player_id: "player-1",
        }}
      />
    );

    expect(screen.getByText("Joined")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view results/i })).toHaveAttribute(
      "href",
      "/room/room-1/winner"
    );
  });
});
