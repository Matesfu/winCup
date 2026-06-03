import { filterMyRooms, parseMyRoomFilters } from "@/lib/my-room-filters";
import type { RoomListItem } from "@/lib/room-list";

const ROOMS: RoomListItem[] = [
  {
    id: "room-1",
    code: "WC-AAAA",
    status: "lobby",
    host_user_id: "user-1",
    host_name: "Alice",
    room_name: "Friday room",
    visibility: "public",
    assignment_mode: "random",
    win_rule: "last_standing",
    stake_amount: 100,
    created_at: "2026-06-01T00:00:00.000Z",
    winner_player_id: null,
    playerCount: 2,
    countryCount: 4,
    userRole: "host",
  },
  {
    id: "room-2",
    code: "WC-BBBB",
    status: "group_stage",
    host_user_id: "user-2",
    host_name: "Bob",
    room_name: "Office cup",
    visibility: "private",
    assignment_mode: "player_choice",
    win_rule: "strict",
    stake_amount: 300,
    created_at: "2026-06-02T00:00:00.000Z",
    winner_player_id: null,
    playerCount: 6,
    countryCount: 8,
    userRole: "player",
  },
  {
    id: "room-3",
    code: "WC-CCCC",
    status: "finished",
    host_user_id: "user-1",
    host_name: "Alice",
    room_name: "Final night",
    visibility: "private",
    assignment_mode: "random",
    win_rule: "strict",
    stake_amount: 50,
    created_at: "2026-05-30T00:00:00.000Z",
    winner_player_id: "player-1",
    playerCount: 3,
    countryCount: 3,
    userRole: "host",
  },
];

describe("my-room-filters", () => {
  it("falls back safely for invalid params", () => {
    const filters = parseMyRoomFilters({
      role: "bad",
      status: "bad",
      mode: "bad",
      sort: "bad",
    });

    expect(filters.role).toBe("all");
    expect(filters.status).toBe("all");
    expect(filters.assignmentMode).toBe("all");
    expect(filters.sort).toBe("recent");
  });

  it("filters by hosted role", () => {
    const rooms = filterMyRooms(ROOMS, {
      ...parseMyRoomFilters(),
      role: "host",
    });

    expect(rooms.map((room) => room.id)).toEqual(["room-1", "room-3"]);
  });

  it("filters active rooms", () => {
    const rooms = filterMyRooms(ROOMS, {
      ...parseMyRoomFilters(),
      status: "active",
    });

    expect(rooms.map((room) => room.id)).toEqual(["room-2"]);
  });

  it("searches by room code", () => {
    const rooms = filterMyRooms(ROOMS, {
      ...parseMyRoomFilters(),
      search: "bbbb",
    });

    expect(rooms).toHaveLength(1);
    expect(rooms[0].id).toBe("room-2");
  });

  it("sorts by stake high", () => {
    const rooms = filterMyRooms(ROOMS, {
      ...parseMyRoomFilters(),
      sort: "stake_high",
    });

    expect(rooms.map((room) => room.id)).toEqual(["room-2", "room-1", "room-3"]);
  });
});
