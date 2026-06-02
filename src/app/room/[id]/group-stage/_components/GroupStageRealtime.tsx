"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Divider } from "@/components/ui/Divider";
import { GroupStatusCard } from "./GroupStatusCard";
import { WorldCupStandingsEmbed } from "./WorldCupStandingsEmbed";
import { subscribeGroupStage } from "@/lib/supabase/realtime";
import type { FifaStage } from "@/lib/fifa";
import type { Player, RoomPublic, RoomCountry } from "@/lib/types/database";

interface CountryInfo {
  code: string;
  name: string;
  flag_emoji: string;
  is_knocked_out: boolean;
}

interface GroupStageRealtimeProps {
  roomId: string;
  initialRoom: Pick<RoomPublic, "id" | "fifa_stage" | "code">;
  initialPlayers: Pick<Player, "id" | "name" | "avatar_emoji" | "assigned_country" | "is_eliminated" | "user_id">[];
  initialRoomCountries: Pick<RoomCountry, "id" | "country_code" | "qualified">[];
  initialCountries: CountryInfo[];
  currentUserId: string;
}

export function GroupStageRealtime({
  roomId,
  initialRoom,
  initialPlayers,
  initialRoomCountries,
  initialCountries,
  currentUserId,
}: GroupStageRealtimeProps) {
  const router = useRouter();
  const [players, setPlayers] = useState(initialPlayers);
  const [roomCountries, setRoomCountries] = useState(initialRoomCountries);
  const [fifaStage, setFifaStage] = useState<FifaStage>(initialRoom.fifa_stage || "First Stage");
  const [liveCountriesMap, setLiveCountriesMap] = useState(
    () => new Map(initialCountries.map((country) => [country.code, country]))
  );

  // Derived state
  const isCountryGloballyKnockedOut = (countryCode: string | null) =>
    Boolean(countryCode && liveCountriesMap.get(countryCode)?.is_knocked_out);
  const isRoomCountryRejected = (countryCode: string | null) =>
    Boolean(
      countryCode &&
        roomCountries.some((country) => country.country_code === countryCode && country.qualified === false)
    );
  const activeCountryCount = roomCountries.filter(
    (country) =>
      !isCountryGloballyKnockedOut(country.country_code) &&
      country.qualified !== false
  ).length;
  const knockedOutCountryCount = roomCountries.length - activeCountryCount;
  const alivePlayers = players.filter(
    (p) =>
      !p.is_eliminated &&
      Boolean(p.assigned_country && liveCountriesMap.has(p.assigned_country)) &&
      !isCountryGloballyKnockedOut(p.assigned_country) &&
      !isRoomCountryRejected(p.assigned_country)
  );
  const eliminatedPlayers = players.filter(
    (p) =>
      p.is_eliminated ||
      isCountryGloballyKnockedOut(p.assigned_country) ||
      isRoomCountryRejected(p.assigned_country)
  );
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
      onCountryStatusUpdated(updated) {
        const countryCode = updated.code;
        if (!countryCode) return;

        setLiveCountriesMap((prev) => {
          const current = prev.get(countryCode);
          if (!current) return prev;

          const next = new Map(prev);
          next.set(countryCode, {
            code: current.code,
            name: updated.name ?? current.name,
            flag_emoji: updated.flag_emoji ?? current.flag_emoji,
            is_knocked_out: updated.is_knocked_out ?? current.is_knocked_out,
          });
          return next;
        });
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
          if (updated.status === "knockout") router.push(`/room/${roomId}/ladder`);
          if (updated.status === "finished") router.push(`/room/${roomId}/winner`);
        }
        if (updated.fifa_stage) {
          setFifaStage(updated.fifa_stage);
        }
      },
    });
    return unsubscribe;
  }, [roomId, router]);

  const getQualifiedForPlayer = (assignedCountry: string | null) => {
    if (!assignedCountry) return null;
    if (isCountryGloballyKnockedOut(assignedCountry)) return false;
    return roomCountries.find((rc) => rc.country_code === assignedCountry)?.qualified ?? null;
  };

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-6 sm:py-8">
      <div className="flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-white/8 bg-background/60 p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold/80">
                Room {initialRoom.code}
              </p>
              <h1 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">
                {fifaStage}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted">
                Stage and country status sync from Supabase. Update the database and everyone sees it live.
              </p>
            </div>
            <div className="flex gap-2 text-xs text-muted">
              <span className="rounded-full bg-white/8 px-3 py-1">
                {players.length} players
              </span>
              <span className="rounded-full bg-white/8 px-3 py-1">
                {activeCountryCount} active
              </span>
              <span className="rounded-full bg-white/8 px-3 py-1">
                {knockedOutCountryCount} out
              </span>
            </div>
          </div>
        </div>

        {/* Active / Alive Players */}
        {alivePlayers.length > 0 && (
          <>
            <Divider label={`Still in Cup (${alivePlayers.length})`} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {alivePlayers.map((p) => (
                <GroupStatusCard
                  key={p.id}
                  player={p}
                  country={p.assigned_country ? (liveCountriesMap.get(p.assigned_country) ?? null) : null}
                  qualified={getQualifiedForPlayer(p.assigned_country)}
                  fifaStage={fifaStage}
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
                  country={p.assigned_country ? (liveCountriesMap.get(p.assigned_country) ?? null) : null}
                  qualified={null}
                  fifaStage={fifaStage}
                  isCurrentUser={p.user_id === currentUserId}
                />
              ))}
            </div>
          </>
        )}

        {/* Knocked Out */}
        {eliminatedPlayers.length > 0 && (
          <>
            <Divider label={`Knocked Out (${eliminatedPlayers.length})`} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {eliminatedPlayers.map((p) => (
                <GroupStatusCard
                  key={p.id}
                  player={p}
                  country={p.assigned_country ? (liveCountriesMap.get(p.assigned_country) ?? null) : null}
                  qualified={false}
                  fifaStage={fifaStage}
                  isCurrentUser={p.user_id === currentUserId}
                />
              ))}
            </div>
          </>
        )}

        <WorldCupStandingsEmbed fifaStage={fifaStage} />
      </div>
    </main>
  );
}
