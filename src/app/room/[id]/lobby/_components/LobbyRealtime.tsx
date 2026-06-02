"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Divider } from "@/components/ui/Divider";
import { CountryChip } from "@/components/ui/CountryChip";
import { RoomCodeDisplay } from "@/components/ui/RoomCodeDisplay";
import { PlayerCard } from "./PlayerCard";
import { KickPlayerButton } from "./KickPlayerButton";
import { LobbyProgress } from "./LobbyProgress";
import { StartDrawButton } from "./StartDrawButton";
import { subscribeLobby } from "@/lib/supabase/realtime";
import type { Player, RoomPublic } from "@/lib/types/database";

interface CountryRow {
  country_code: string;
  countries: { code: string; name: string; flag_emoji: string };
}

interface LobbyRealtimeProps {
  roomId: string;
  initialRoom: RoomPublic;
  initialPlayers: Player[];
  initialCountries: CountryRow[];
  currentUserId: string;
  isHost: boolean;
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
  const newPlayerIds = useRef<Set<string>>(new Set());

  const totalSlots = initialCountries.length;
  const isReady = players.length >= totalSlots && totalSlots > 0;

  useEffect(() => {
    const unsubscribe = subscribeLobby(roomId, {
      onPlayerJoined(player) {
        setPlayers((prev) => {
          if (prev.some((p) => p.id === player.id)) return prev;
          newPlayerIds.current.add(player.id);
          return [...prev, player];
        });
      },
      onPlayerRemoved(playerId) {
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
          if (updated.status === "drawn") {
            router.push(`/room/${roomId}/draw`);
          }
        }
      },
    });

    return unsubscribe;
  }, [roomId, router, currentUserId]);

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8">
      <div className="w-full max-w-lg flex flex-col gap-6">

        {/* Room code + share */}
        <RoomCodeDisplay code={room.code} />

        {/* Room meta */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted">
          <span>
            {room.win_rule === "strict" ? "Must Win the Cup" : "Last Team Standing"}
          </span>
          {room.stake_amount !== null && (
            <span>Stake: £{room.stake_amount}</span>
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
        <LobbyProgress joined={players.length} total={totalSlots} />

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
                  animate={newPlayerIds.current.has(player.id)}
                  kickButton={kickButton}
                />
              </div>
            );
          })}
        </div>

        <Divider />

        {/* Host CTA / Non-host waiting */}
        {isHost ? (
          <StartDrawButton roomId={roomId} isReady={isReady} />
        ) : (
          <div className="flex flex-col items-center gap-1 py-2" data-testid="waiting-message">
            <p className="animate-pulse text-sm text-muted">
              ⏳ Waiting for the host to start the draw…
            </p>
          </div>
        )}

      </div>
    </main>
  );
}
