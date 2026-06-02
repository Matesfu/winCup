"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Divider } from "@/components/ui/Divider";
import { GroupStatusCard } from "./GroupStatusCard";
import { HostOverridePanel } from "./HostOverridePanel";
import { subscribeGroupStage } from "@/lib/supabase/realtime";
import type { Player, RoomPublic, RoomCountry } from "@/lib/types/database";

interface CountryInfo {
  code: string;
  name: string;
  flag_emoji: string;
}

interface GroupStageRealtimeProps {
  roomId: string;
  initialRoom: Pick<RoomPublic, "id" | "status" | "host_user_id" | "code">;
  initialPlayers: Pick<Player, "id" | "name" | "avatar_emoji" | "assigned_country" | "is_eliminated" | "user_id">[];
  initialRoomCountries: Pick<RoomCountry, "id" | "country_code" | "qualified">[];
  countriesMap: Map<string, CountryInfo>;
  isHost: boolean;
  currentUserId: string;
}

export function GroupStageRealtime({
  roomId,
  initialRoom,
  initialPlayers,
  initialRoomCountries,
  countriesMap,
  isHost,
  currentUserId,
}: GroupStageRealtimeProps) {
  const router = useRouter();
  const [players, setPlayers] = useState(initialPlayers);
  const [roomCountries, setRoomCountries] = useState(initialRoomCountries);
  const [roomStatus, setRoomStatus] = useState(initialRoom.status);

  // Derived state
  const allDecided = roomCountries.length > 0 && roomCountries.every((rc) => rc.qualified !== null);
  const alivePlayers = players.filter((p) => !p.is_eliminated && roomCountries.some((rc) => rc.country_code === p.assigned_country && rc.qualified === true));
  const eliminatedPlayers = players.filter((p) => p.is_eliminated || roomCountries.some((rc) => rc.country_code === p.assigned_country && rc.qualified === false));
  const undecidedPlayers = players.filter((p) =>
    !alivePlayers.includes(p) && !eliminatedPlayers.includes(p)
  );

  useEffect(() => {
    const unsubscribe = subscribeGroupStage(roomId, {
      onCountryUpdated(rc) {
        setRoomCountries((prev) =>
          prev.map((c) =>
            c.country_code === rc.country_code
              ? { ...c, ...(rc as Partial<RoomCountry>) }
              : c
          )
        );
      },
      onPlayerUpdated(updated) {
        setPlayers((prev) =>
          prev.map((p) =>
            p.id === updated.id ? { ...p, ...(updated as Partial<typeof p>) } : p
          )
        );
      },
      onRoomUpdated(updated) {
        if (updated.status) {
          setRoomStatus(updated.status as RoomPublic["status"]);
          if (updated.status === "knockout") router.push(`/room/${roomId}/ladder`);
          if (updated.status === "finished") router.push(`/room/${roomId}/winner`);
        }
      },
    });
    return unsubscribe;
  }, [roomId, router]);

  const getQualifiedForPlayer = (assignedCountry: string | null) => {
    if (!assignedCountry) return null;
    return roomCountries.find((rc) => rc.country_code === assignedCountry)?.qualified ?? null;
  };

  const isWaiting = roomStatus === "drawn";

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8">
      <div className="w-full max-w-2xl flex flex-col gap-6">

        {/* Waiting overlay for non-host when still in drawn state */}
        {isWaiting && !isHost && (
          <div className="flex items-center justify-center rounded-2xl border border-gold/20 bg-gold/5 p-6 text-center">
            <p className="animate-pulse text-sm text-muted">
              ⏳ Waiting for the host to advance to the Group Stage…
            </p>
          </div>
        )}

        {/* Page heading */}
        {!isWaiting && (
          <div className="text-center">
            <h1 className="text-2xl font-extrabold text-white">Group Stage</h1>
            <p className="mt-1 text-sm text-muted">
              {allDecided
                ? "All countries decided — ready for the knockout round."
                : "Waiting for group stage results…"}
            </p>
          </div>
        )}

        {/* Active / Alive Players */}
        {alivePlayers.length > 0 && (
          <>
            <Divider label={`Still Alive (${alivePlayers.length})`} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {alivePlayers.map((p) => (
                <GroupStatusCard
                  key={p.id}
                  player={p}
                  country={p.assigned_country ? (countriesMap.get(p.assigned_country) ?? null) : null}
                  qualified={getQualifiedForPlayer(p.assigned_country)}
                  isCurrentUser={p.user_id === currentUserId}
                />
              ))}
            </div>
          </>
        )}

        {/* Undecided Players */}
        {undecidedPlayers.length > 0 && (
          <>
            <Divider label={`Undecided (${undecidedPlayers.length})`} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {undecidedPlayers.map((p) => (
                <GroupStatusCard
                  key={p.id}
                  player={p}
                  country={p.assigned_country ? (countriesMap.get(p.assigned_country) ?? null) : null}
                  qualified={null}
                  isCurrentUser={p.user_id === currentUserId}
                />
              ))}
            </div>
          </>
        )}

        {/* Knocked Out in Groups */}
        {eliminatedPlayers.length > 0 && (
          <>
            <Divider label={`Knocked Out in Groups (${eliminatedPlayers.length})`} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {eliminatedPlayers.map((p) => (
                <GroupStatusCard
                  key={p.id}
                  player={p}
                  country={p.assigned_country ? (countriesMap.get(p.assigned_country) ?? null) : null}
                  qualified={false}
                  isCurrentUser={p.user_id === currentUserId}
                />
              ))}
            </div>
          </>
        )}

        {/* Host override panel */}
        {isHost && !isWaiting && (
          <HostOverridePanel
            roomId={roomId}
            roomCountries={roomCountries}
            countriesMap={countriesMap}
            allDecided={allDecided}
          />
        )}
      </div>
    </main>
  );
}
