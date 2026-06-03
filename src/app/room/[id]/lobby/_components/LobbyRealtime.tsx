"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Divider } from "@/components/ui/Divider";
import { CountryChip } from "@/components/ui/CountryChip";
import { RoomCodeDisplay } from "@/components/ui/RoomCodeDisplay";
import { PlayerCard } from "./PlayerCard";
import { KickPlayerButton } from "./KickPlayerButton";
import { LobbyProgress } from "./LobbyProgress";
import { StartDrawButton } from "./StartDrawButton";
import { DeleteRoomButton } from "./DeleteRoomButton";
import { subscribeLobby } from "@/lib/supabase/realtime";
import type { Player, RoomPublic } from "@/lib/types/database";

interface CountryRow {
  country_code: string;
  countries: { code: string; name: string; flag_emoji: string; is_knocked_out: boolean };
}

interface LobbyRealtimeProps {
  roomId: string;
  initialRoom: RoomPublic;
  initialPlayers: Player[];
  initialCountries: CountryRow[];
  currentUserId: string;
  isHost: boolean;
}

interface LobbyStateResponse {
  room: Pick<RoomPublic, "status">;
  players: Player[];
}

export function LobbyRealtime({
  roomId,
  initialRoom,
  initialPlayers,
  initialCountries,
  currentUserId,
  isHost,
}: LobbyRealtimeProps) {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [room, setRoom] = useState<RoomPublic>(initialRoom);
  // Track which player IDs are new (to animate entrance)
  const [newPlayerIds, setNewPlayerIds] = useState<Set<string>>(() => new Set());
  const hasRedirectedRef = useRef(false);
  const knownPlayerIdsRef = useRef<Set<string>>(
    new Set(initialPlayers.map((player) => player.id))
  );

  const totalSlots = initialCountries.length;
  const assignmentMode = room.assignment_mode;
  const isPlayerChoice = assignmentMode === "player_choice";
  const chosenCount = players.filter((player) => player.assigned_country).length;
  const countryByCode = useMemo(
    () =>
      new Map(
        initialCountries.map((row) => [
          row.country_code,
          row.countries,
        ])
      ),
    [initialCountries]
  );
  const isReady =
    totalSlots >= 2 &&
    (isPlayerChoice
      ? chosenCount >= 2 && chosenCount === players.length
      : players.length >= 2 && players.length <= totalSlots);
  const waitingMessage =
    totalSlots < 2
      ? "This room needs at least 2 selectable countries."
      : isPlayerChoice
        ? chosenCount < 2
          ? "Waiting for at least 2 players to choose countries."
          : chosenCount !== players.length
            ? "Waiting for every joined player to choose a country."
            : "Ready to start."
        : players.length < 2
          ? "Waiting for at least 2 players before the draw."
          : players.length > totalSlots
            ? "There are more players than available countries."
            : "Ready to draw.";

  const redirectForStatus = useCallback(
    (status: RoomPublic["status"]) => {
      if (hasRedirectedRef.current) return;

      const nextPath =
        status === "drawn"
          ? `/room/${roomId}/draw`
          : status === "group_stage"
            ? `/room/${roomId}/group-stage`
            : status === "knockout"
              ? `/room/${roomId}/ladder`
              : status === "finished"
                ? `/room/${roomId}/winner`
                : null;

      if (!nextPath) return;

      hasRedirectedRef.current = true;
      router.replace(nextPath);
    },
    [roomId, router]
  );

  const markNewPlayers = useCallback((playerIds: string[]) => {
    if (playerIds.length === 0) return;

    setNewPlayerIds((previousIds) => {
      const nextIds = new Set(previousIds);
      playerIds.forEach((playerId) => nextIds.add(playerId));
      return nextIds;
    });
  }, []);

  const syncLobbyState = useCallback(async (signal?: AbortSignal) => {
    if (hasRedirectedRef.current) return;

    const response = await fetch(`/api/rooms/${roomId}/lobby-state`, {
      cache: "no-store",
      signal,
    });

    if (signal?.aborted) return;

    if (response.status === 404) {
      router.replace("/dashboard");
      return;
    }

    if (response.status === 403) {
      router.push("/room/join");
      return;
    }

    if (!response.ok) return;

    const data = (await response.json()) as LobbyStateResponse;

    if (signal?.aborted) return;

    if (data.room?.status) {
      setRoom((previousRoom) => ({ ...previousRoom, status: data.room.status }));
      redirectForStatus(data.room.status);
    }

    if (!Array.isArray(data.players)) return;

    const incomingPlayerIds = new Set(data.players.map((player) => player.id));
    const newPlayerIdsFromSnapshot = data.players
      .filter((player) => !knownPlayerIdsRef.current.has(player.id))
      .map((player) => player.id);

    knownPlayerIdsRef.current = incomingPlayerIds;
    markNewPlayers(newPlayerIdsFromSnapshot);
    setPlayers(data.players);
  }, [roomId, router, redirectForStatus, markNewPlayers]);

  useEffect(() => {
    const unsubscribe = subscribeLobby(roomId, {
      onPlayerJoined(player) {
        const isNewPlayer = !knownPlayerIdsRef.current.has(player.id);
        knownPlayerIdsRef.current.add(player.id);

        setPlayers((prev) => {
          if (prev.some((p) => p.id === player.id)) return prev;
          return [...prev, player];
        });
        if (isNewPlayer) markNewPlayers([player.id]);
      },
      onPlayerRemoved(playerId) {
        knownPlayerIdsRef.current.delete(playerId);

        // Remove from the list when the host kicks someone.
        // If the kicked player is viewing this lobby, redirect them to the join page.
        setPlayers((prev) => {
          const removed = prev.find((p) => p.id === playerId);
          if (removed?.user_id === currentUserId) {
            // This user was kicked — redirect them out of the lobby
            router.push(`/room/join`);
          }
          return prev.filter((p) => p.id !== playerId);
        });
      },
      onRoomUpdated(updated) {
        if (updated.status) {
          setRoom((prev) => ({ ...prev, ...updated } as RoomPublic));
          redirectForStatus(updated.status as RoomPublic["status"]);
        }
      },
      onRoomDeleted() {
        router.replace("/dashboard");
      },
    });

    return unsubscribe;
  }, [roomId, router, currentUserId, redirectForStatus, markNewPlayers]);

  useEffect(() => {
    const abortController = new AbortController();

    const safeSyncLobbyState = () => {
      void syncLobbyState(abortController.signal).catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      });
    };

    safeSyncLobbyState();
    const intervalId = window.setInterval(() => {
      safeSyncLobbyState();
    }, 2000);

    return () => {
      abortController.abort();
      window.clearInterval(intervalId);
    };
  }, [syncLobbyState]);

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8">
      <div className="w-full max-w-lg flex flex-col gap-6">

        {/* Room code + share */}
        <RoomCodeDisplay code={room.code} />

        {/* Room meta */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="text-white">
            {room.room_name}
          </span>
          <span>
            {isPlayerChoice ? "Player choice" : "Random assignment"}
          </span>
          <span>
            {room.visibility === "public" ? "Public room" : "Private room"}
          </span>
          <span>
            {room.win_rule === "strict" ? "Must Win the Cup" : "Last Team Standing"}
          </span>
          {room.stake_amount !== null && (
            <span>Stake: {room.stake_amount} Birr</span>
          )}
        </div>

        <Divider label={`Countries (${totalSlots})`} />

        {/* Country chips */}
        <div className="flex flex-wrap justify-center gap-1.5">
          {initialCountries.map((rc) => (
            <CountryChip
              key={rc.country_code}
              code={rc.countries.code}
              name={rc.countries.name}
              flagEmoji={rc.countries.flag_emoji}
              size="sm"
            />
          ))}
        </div>

        <Divider label="Players" />

        {/* Progress */}
        <LobbyProgress
          joined={players.length}
          total={totalSlots}
          assignmentMode={assignmentMode}
          chosen={chosenCount}
          isReady={isReady}
        />

        {/* Player list */}
        <div
          role="list"
          aria-label="Players in lobby"
          className="flex flex-col gap-2"
        >
          {players.map((player) => {
            const isThisPlayerTheHost = player.user_id === initialRoom.host_user_id;
            const isThisPlayerCurrentUser = player.user_id === currentUserId;

            // Show a kick button only: host is viewing, it's not their own card,
            // and the player being shown is not the host themselves.
            const kickButton =
              isHost && !isThisPlayerCurrentUser && !isThisPlayerTheHost ? (
                <KickPlayerButton
                  roomId={roomId}
                  playerId={player.id}
                  playerName={player.name}
                />
              ) : undefined;

            return (
              <div key={player.id} role="listitem">
                <PlayerCard
                  player={player}
                  isHost={isThisPlayerTheHost}
                  isCurrentUser={isThisPlayerCurrentUser}
                  animate={newPlayerIds.has(player.id)}
                  country={
                    player.assigned_country
                      ? countryByCode.get(player.assigned_country)
                      : undefined
                  }
                  kickButton={kickButton}
                />
              </div>
            );
          })}
        </div>

        <Divider />

        {/* Host CTA / Non-host waiting */}
        {isHost ? (
          <div className="flex w-full flex-col items-center gap-4">
            <StartDrawButton
              roomId={roomId}
              isReady={isReady}
              assignmentMode={assignmentMode}
              waitingMessage={waitingMessage}
            />
            <DeleteRoomButton roomId={roomId} roomName={room.room_name} />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 py-2" data-testid="waiting-message">
            <p className="animate-pulse text-sm text-muted">
              ⏳ Waiting for the host to {isPlayerChoice ? "start the room" : "start the draw"}…
            </p>
          </div>
        )}

      </div>
    </main>
  );
}
