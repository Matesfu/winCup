import "@testing-library/jest-dom";
import { act, render, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { LobbyRealtime } from "@/app/room/[id]/lobby/_components/LobbyRealtime";
import { subscribeLobby } from "@/lib/supabase/realtime";
import type { Player, RoomPublic } from "@/lib/types/database";

jest.mock("@/lib/supabase/realtime", () => ({
  subscribeLobby: jest.fn(),
}));

const ROOM: RoomPublic = {
  id: "room-1",
  code: "WC-ABCD",
  host_user_id: "host-1",
  host_name: "Host",
  room_name: "Host room",
  visibility: "private",
  assignment_mode: "random",
  status: "lobby",
  stage_title: "Group Stage",
  fifa_stage: "First Stage",
  win_rule: "last_standing",
  stake_amount: null,
  external_competition_id: null,
  external_season_id: null,
  winner_player_id: null,
  created_at: "2026-06-03T00:00:00.000Z",
  started_at: null,
};

const PLAYERS: Player[] = [
  {
    id: "player-1",
    room_id: "room-1",
    user_id: "host-1",
    name: "Host",
    avatar_emoji: "🏆",
    assigned_country: null,
    is_eliminated: false,
    joined_at: "2026-06-03T00:00:00.000Z",
  },
];

const COUNTRIES = [
  {
    country_code: "ARG",
    countries: {
      code: "ARG",
      name: "Argentina",
      flag_emoji: "🇦🇷",
      is_knocked_out: false,
    },
  },
  {
    country_code: "BRA",
    countries: {
      code: "BRA",
      name: "Brazil",
      flag_emoji: "🇧🇷",
      is_knocked_out: false,
    },
  },
];

describe("LobbyRealtime", () => {
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
    (subscribeLobby as jest.Mock).mockReturnValue(unsubscribe);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        room: { status: "lobby" },
        players: PLAYERS,
      }),
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("replaces history when realtime moves the room to draw", async () => {
    render(
      <LobbyRealtime
        roomId="room-1"
        initialRoom={ROOM}
        initialPlayers={PLAYERS}
        initialCountries={COUNTRIES}
        currentUserId="host-1"
        isHost
      />
    );

    await waitFor(() => expect(subscribeLobby).toHaveBeenCalled());
    const callbacks = (subscribeLobby as jest.Mock).mock.calls[0][1];

    act(() => {
      callbacks.onRoomUpdated({ status: "drawn" });
    });

    expect(replace).toHaveBeenCalledWith("/room/room-1/draw");
    expect(push).not.toHaveBeenCalledWith("/room/room-1/draw");
  });

  it("redirects to sign-in when the lobby state API returns 401", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Not authenticated." }),
    }) as jest.Mock;

    render(
      <LobbyRealtime
        roomId="room-1"
        initialRoom={ROOM}
        initialPlayers={PLAYERS}
        initialCountries={COUNTRIES}
        currentUserId="host-1"
        isHost
      />
    );

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        "/auth/sign-in?redirectTo=%2Froom%2Froom-1%2Flobby"
      )
    );
  });
});
