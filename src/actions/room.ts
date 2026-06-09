"use server";

import { redirect, RedirectType } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { generateRoomCode } from "@/lib/room-code";
import { Validation } from "@/lib/validation";
import {
  getPrivateRoomJoinCookieName,
  normalizeRoomCode,
  PRIVATE_ROOM_JOIN_COOKIE_MAX_AGE,
} from "@/lib/private-room-access";
// Import from @/lib/constants (no directive) — not from the "use client" EmojiPicker
// component, which would cause a Client Reference proxy on the server and break .includes()
import { ALLOWED_AVATARS } from "@/lib/constants";
import type {
  AssignmentMode,
  WinRule,
  Country,
  Player,
  RoomPublic,
  RoomTeam,
  KnockoutStage,
  RoomVisibility,
} from "@/lib/types/database";
import { assignCountries } from "@/lib/draw";
import { resolveRoomIfComplete } from "@/lib/resolution";
import {
  buildRoomTeamInserts,
  assignSequentialPositions,
  getStartingStage,
  getNextStageInfo,
  positionAtStage,
  STAGE_ORDER,
} from "@/lib/bracket";
import { fetchR16Fixtures } from "@/lib/football-data";

// NOTE: @supabase/postgrest-js 2.106.x + TypeScript 5.9 has a generic type regression
// where insert/select types resolve to `never`. We use (admin as any).from(...)
// with explicit result casts. Runtime behaviour is fully correct.

// ─── Types ──────────────────────────────────────────────────────────────────────

export type CreateRoomState = {
  errors?: {
    roomName?: string;
    hostName?: string;
    countries?: string;
    winRule?: string;
    assignmentMode?: string;
    visibility?: string;
    hostCountry?: string;
    stakeAmount?: string;
    form?: string;
  };
} | null;

// ─── createRoom ─────────────────────────────────────────────────────────────────

export async function createRoom(
  prevState: CreateRoomState,
  formData: FormData
): Promise<CreateRoomState> {
  // 1. Require authenticated session
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?redirectTo=/room/create");
  }

  // 2. Parse inputs
  const roomName = (formData.get("roomName") as string) ?? "";
  const hostName = (formData.get("hostName") as string) ?? "";
  const avatarEmoji = (formData.get("avatarEmoji") as string) ?? "";
  const winRule = (formData.get("winRule") as WinRule) ?? "last_standing";
  const assignmentMode = ((formData.get("assignmentMode") as string) ?? "random") as AssignmentMode;
  const visibility = ((formData.get("visibility") as string) ?? "private") as RoomVisibility;
  const stakeAmountRaw = (formData.get("stakeAmount") as string) ?? "";
  const countries = formData.getAll("countries") as string[];
  const selectedCountryCodes = Array.from(new Set(countries));
  const hostCountryCode = ((formData.get("hostCountryCode") as string) ?? "").trim();
  // Whether the host wants to participate as a player (default: true)
  const hostIsPlaying = (formData.get("hostIsPlaying") as string) !== "false";

  // 3. Server-side validation
  const roomNameError = Validation.roomName(roomName);
  const hostNameError = Validation.hostName(hostName);
  const winRuleError = Validation.winRule(winRule);
  const assignmentModeError = Validation.assignmentMode(assignmentMode);
  const visibilityError = Validation.roomVisibility(visibility);
  const countryError = Validation.countrySelection(selectedCountryCodes);
  const stakeError = Validation.stakeAmount(stakeAmountRaw);
  const hostCountryError =
    assignmentMode === "player_choice" && hostIsPlaying
      ? Validation.countryChoice(hostCountryCode)
      : null;

  if (
    roomNameError ||
    hostNameError ||
    winRuleError ||
    assignmentModeError ||
    visibilityError ||
    countryError ||
    stakeError ||
    hostCountryError ||
    selectedCountryCodes.length !== countries.length
  ) {
    return {
      errors: {
        ...(roomNameError && { roomName: roomNameError }),
        ...(hostNameError && { hostName: hostNameError }),
        ...(winRuleError && { winRule: winRuleError }),
        ...(assignmentModeError && { assignmentMode: assignmentModeError }),
        ...(visibilityError && { visibility: visibilityError }),
        ...(countryError && { countries: countryError }),
        ...(selectedCountryCodes.length !== countries.length && { countries: "Duplicate countries are not allowed." }),
        ...(stakeError && { stakeAmount: stakeError }),
        ...(hostCountryError && { hostCountry: hostCountryError }),
      },
    };
  }

  // Validate avatar
  if (!ALLOWED_AVATARS.includes(avatarEmoji as (typeof ALLOWED_AVATARS)[number])) {
    return { errors: { form: "Invalid avatar selection" } };
  }

  const admin = createAdminClient();

  // 4. Rate limit: max 3 rooms per user in last 10 minutes
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: recentRooms } = await (admin as any)
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .eq("host_user_id", user.id)
    .gte("created_at", tenMinutesAgo) as { count: number | null };

  if ((recentRooms ?? 0) >= 3) {
    return {
      errors: {
        form: "Too many rooms created recently. Please wait a few minutes.",
      },
    };
  }

  // 5. Validate country codes exist and are still selectable
  const { data: validCountries } = await (admin as any)
    .from("countries")
    .select("code,name,is_knocked_out")
    .in("code", selectedCountryCodes) as {
      data: Pick<Country, "code" | "name" | "is_knocked_out">[] | null;
    };

  if (!validCountries || validCountries.length !== selectedCountryCodes.length) {
    return { errors: { countries: "One or more country codes are invalid" } };
  }

  const knockedOutCountries = validCountries.filter((country) => country.is_knocked_out);
  if (knockedOutCountries.length > 0) {
    return {
      errors: {
        countries: `Remove knocked-out countries: ${knockedOutCountries
          .map((country) => country.name)
          .join(", ")}.`,
      },
    };
  }

  if (
    assignmentMode === "player_choice" &&
    hostIsPlaying &&
    !selectedCountryCodes.includes(hostCountryCode)
  ) {
    return { errors: { hostCountry: "Choose one of the selected room countries." } };
  }

  // 6. Generate unique room code (up to 5 retries)
  let roomCode: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateRoomCode();
    const { data: existing } = await (admin as any)
      .from("rooms")
      .select("id")
      .eq("code", candidate)
      .maybeSingle() as { data: { id: string } | null };
    if (!existing) {
      roomCode = candidate;
      break;
    }
  }

  if (!roomCode) {
    return {
      errors: { form: "Failed to generate a room code. Please try again." },
    };
  }

  // 7. Parse required stake amount
  const stakeAmount = Number(stakeAmountRaw);

  // 8. Insert room
  const { data: room, error: roomError } = await (admin as any)
    .from("rooms")
    .insert({
      code: roomCode,
      host_user_id: user.id,
      host_name: hostName.trim(),
      room_name: roomName.trim(),
      visibility,
      assignment_mode: assignmentMode,
      status: "lobby",
      win_rule: winRule,
      stake_amount: stakeAmount,
      host_secret: crypto.randomUUID(),
    })
    .select("id")
    .single() as { data: { id: string } | null; error: unknown };

  if (roomError || !room) {
    return { errors: { form: "Failed to create room. Please try again." } };
  }

  // 9. Insert room_countries (batch)
  const { error: countriesError } = await (admin as any)
    .from("room_countries")
    .insert(
      selectedCountryCodes.map((code) => ({
        room_id: room.id,
        country_code: code,
        qualified: null,
      }))
    ) as { error: unknown };

  if (countriesError) {
    await (admin as any).from("rooms").delete().eq("id", room.id);
    return {
      errors: {
        form: "Failed to save country selection. Please try again.",
      },
    };
  }

  // 10. Optionally insert the host as the first player
  //     Skipped when the host chose "I'm not playing" on the create-room form.
  if (hostIsPlaying) {
    const { error: playerError } = await (admin as any)
      .from("players")
      .insert({
        room_id: room.id,
        user_id: user.id,
        name: hostName.trim(),
        avatar_emoji: avatarEmoji,
        assigned_country: assignmentMode === "player_choice" ? hostCountryCode : null,
        is_eliminated: false,
      }) as { error: unknown };

    if (playerError) {
      await (admin as any).from("rooms").delete().eq("id", room.id);
      return {
        errors: { form: "Failed to set up your player. Please try again." },
      };
    }
  }

  // 11. Navigate to the lobby
  redirect(`/room/${room.id}/lobby`, RedirectType.replace);
}

// ─── kickPlayer ───────────────────────────────────────────────────────────────

export type KickPlayerState = { error?: string } | null;

/**
 * Host-only: remove a player from the lobby before the draw starts.
 * The kicked player is deleted from the players table.
 * Realtime broadcasts the DELETE event to all lobby clients.
 */
export async function kickPlayer(
  prevState: KickPlayerState,
  formData: FormData
): Promise<KickPlayerState> {
  const roomId = (formData.get("roomId") as string) ?? "";
  const playerId = (formData.get("playerId") as string) ?? "";

  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  // Verify host ownership and room status
  const { data: room } = await (admin as any)
    .from("rooms")
    .select("id, status, host_user_id")
    .eq("id", roomId)
    .maybeSingle() as { data: Pick<RoomPublic, "id" | "status" | "host_user_id"> | null };

  if (!room) return { error: "Room not found." };
  if (room.host_user_id !== user.id) return { error: "Only the host can remove players." };
  if (room.status !== "lobby") return { error: "Players can only be removed before the draw starts." };

  // Confirm the player exists in this room and is not the host themselves
  const { data: player } = await (admin as any)
    .from("players")
    .select("id, user_id")
    .eq("id", playerId)
    .eq("room_id", roomId)
    .maybeSingle() as { data: Pick<Player, "id" | "user_id"> | null };

  if (!player) return { error: "Player not found in this room." };
  if (player.user_id === user.id) return { error: "You cannot remove yourself." };

  // Delete the player — Realtime DELETE event notifies all lobby clients
  const { error: deleteError } = await (admin as any)
    .from("players")
    .delete()
    .eq("id", playerId) as { error: unknown };

  if (deleteError) return { error: "Failed to remove player. Please try again." };

  return null; // success
}

// ─── deleteRoom ───────────────────────────────────────────────────────────────

export type DeleteRoomState = { error?: string } | null;

/**
 * Host-only: delete a room while it is still waiting in the lobby.
 * Once the room has started, deletion is blocked to preserve the game record.
 */
export async function deleteRoom(
  prevState: DeleteRoomState,
  formData: FormData
): Promise<DeleteRoomState> {
  const roomId = (formData.get("roomId") as string) ?? "";
  if (!roomId) return { error: "Room id is missing." };

  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: room } = await (admin as any)
    .from("rooms")
    .select("id, status, host_user_id")
    .eq("id", roomId)
    .maybeSingle() as {
      data: Pick<RoomPublic, "id" | "status" | "host_user_id"> | null;
    };

  if (!room) return { error: "Room not found." };
  if (room.host_user_id !== user.id) return { error: "Only the host can delete this room." };
  if (room.status !== "lobby") {
    return { error: "This room has already started and cannot be deleted." };
  }

  const { error: deleteError } = await (admin as any)
    .from("rooms")
    .delete()
    .eq("id", roomId) as { error: unknown };

  if (deleteError) return { error: "Failed to delete room. Please try again." };

  redirect("/dashboard", RedirectType.replace);
}

// ─── lookupRoomByCode ─────────────────────────────────────────────────────────

export type LookupRoomState = {
  error?: string;
} | null;

/**
 * Validates a room code and redirects to the room-specific join page.
 * Public — no authentication required.
 */
export async function lookupRoomByCode(
  prevState: LookupRoomState,
  formData: FormData
): Promise<LookupRoomState> {
  const raw = (formData.get("code") as string) ?? "";
  const codeError = Validation.roomCode(raw);
  if (codeError) return { error: codeError };

  const code = normalizeRoomCode(raw);

  const admin = createAdminClient();
  const { data: room, error: queryError } = await (admin as any)
    .from("rooms")
    .select("id, status")
    .eq("code", code)
    .maybeSingle() as { data: Pick<RoomPublic, "id" | "status"> | null; error: { message?: string } | null };

  if (queryError) {
    console.error("[lookupRoomByCode] Supabase error:", queryError);
    return { error: "Could not look up room. Check the code and try again." };
  }

  if (!room) return { error: "Room not found. Check the code and try again." };
  if (room.status !== "lobby") return { error: "That room's game has already started." };

  const cookieStore = await cookies();
  cookieStore.set({
    name: getPrivateRoomJoinCookieName(room.id),
    value: code,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: PRIVATE_ROOM_JOIN_COOKIE_MAX_AGE,
    path: `/room/${room.id}`,
  });

  redirect(`/room/${room.id}/join`, RedirectType.replace);
}

// ─── joinRoom ─────────────────────────────────────────────────────────────────

export type JoinRoomState = {
  errors?: {
    playerName?: string;
    countryCode?: string;
    form?: string;
  };
} | null;

/**
 * Validates a join request and inserts the player.
 * Requires authentication — redirects to sign-in if session is absent.
 */
export async function joinRoom(
  prevState: JoinRoomState,
  formData: FormData
): Promise<JoinRoomState> {
  const roomId = (formData.get("roomId") as string) ?? "";
  const playerName = (formData.get("playerName") as string) ?? "";
  const avatarEmoji = (formData.get("avatarEmoji") as string) ?? "";
  const countryCode = ((formData.get("countryCode") as string) ?? "").trim();

  // 1. Require authenticated session
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/sign-in?redirectTo=/room/${roomId}/join`);
  }

  // 2. Validate inputs
  const nameError = Validation.hostName(playerName);
  if (nameError) return { errors: { playerName: nameError } };

  if (!ALLOWED_AVATARS.includes(avatarEmoji as (typeof ALLOWED_AVATARS)[number])) {
    return { errors: { form: "Invalid avatar selection" } };
  }

  const admin = createAdminClient();

  // 3. Fetch room state
  const { data: room } = await (admin as any)
    .from("rooms")
    .select("id, code, status, host_user_id, assignment_mode, visibility")
    .eq("id", roomId)
    .maybeSingle() as {
      data: Pick<RoomPublic, "id" | "code" | "status" | "host_user_id" | "assignment_mode" | "visibility"> | null;
    };

  if (!room) return { errors: { form: "Room not found." } };
  if (room.status !== "lobby") {
    return { errors: { form: "This game has already started. You cannot join." } };
  }

  // 4. Check capacity and selected country pool
  const { data: roomCountries } = await (admin as any)
    .from("room_countries")
    .select("country_code, countries:countries(code,name,is_knocked_out)")
    .eq("room_id", roomId) as {
      data: {
        country_code: string;
        countries: Pick<Country, "code" | "name" | "is_knocked_out">;
      }[] | null;
    };

  const { data: players } = await (admin as any)
    .from("players")
    .select("id, user_id, assigned_country")
    .eq("room_id", roomId) as {
      data: Pick<Player, "id" | "user_id" | "assigned_country">[] | null;
    };

  const playerList = players ?? [];
  const selectedCountries = roomCountries ?? [];
  const selectableCountries = selectedCountries.filter(
    (country) => !country.countries.is_knocked_out
  );
  const countryCount = selectableCountries.length;

  // 5. Duplicate-join check — already in this room
  const alreadyJoined = playerList.some((p) => p.user_id === user.id);
  if (alreadyJoined) redirect(`/room/${roomId}/lobby`, RedirectType.replace);

  if (room.visibility === "private" && room.host_user_id !== user.id) {
    const cookieStore = await cookies();
    const joinCookie = cookieStore.get(getPrivateRoomJoinCookieName(roomId));
    if (joinCookie?.value !== room.code) {
      return { errors: { form: "Enter the private room code before joining." } };
    }
  }

  // 6. Capacity check
  if (countryCount < 2) {
    return {
      errors: {
        form: "This room does not have at least 2 countries still in the cup.",
      },
    };
  }

  if (playerList.length >= countryCount) {
    return { errors: { form: "This room is full." } };
  }

  let assignedCountry: string | null = null;

  if (room.assignment_mode === "player_choice") {
    const countryError = Validation.countryChoice(countryCode);
    if (countryError) return { errors: { countryCode: countryError } };

    const selectedCountry = selectedCountries.find((country) => country.country_code === countryCode);
    if (!selectedCountry) {
      return { errors: { countryCode: "Choose a country from this room." } };
    }
    if (selectedCountry.countries.is_knocked_out) {
      return { errors: { countryCode: `${selectedCountry.countries.name} is already knocked out.` } };
    }
    if (playerList.some((player) => player.assigned_country === countryCode)) {
      return { errors: { countryCode: "That country is already taken." } };
    }

    assignedCountry = countryCode;
  }

  // 7. Rate limit: max 10 joins per 30 minutes
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: recentJoins } = await (admin as any)
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("joined_at", thirtyMinutesAgo) as { data: null; count: number | null };

  if ((recentJoins as unknown as number | null ?? 0) >= 10) {
    return { errors: { form: "Too many join attempts. Please wait a moment." } };
  }

  // 8. Insert player
  const { error: insertError } = await (admin as any)
    .from("players")
    .insert({
      room_id: roomId,
      user_id: user.id,
      name: playerName.trim(),
      avatar_emoji: avatarEmoji,
      assigned_country: assignedCountry,
      is_eliminated: false,
    }) as { error: unknown };

  if (insertError) {
    const message = insertError && typeof insertError === "object" && "message" in insertError
      ? String((insertError as { message?: string }).message ?? "")
      : "";
    if (room.assignment_mode === "player_choice" && message.includes("idx_players_room_assigned_country_unique")) {
      return { errors: { countryCode: "That country was just taken. Choose another one." } };
    }
    return { errors: { form: "Failed to join room. Please try again." } };
  }

  revalidatePath(`/room/${roomId}`, "layout");
  redirect(`/room/${roomId}/lobby`, RedirectType.replace);
}

// ─── startDraw / startRoom ────────────────────────────────────────────────────

export type StartDrawState = {
  error?: string;
} | null;

/**
 * Host-only action that starts the room.
 * Random rooms run the secure draw.
 * Player-choice rooms skip draw animation and go straight to group stage.
 */
export async function startDraw(
  prevState: StartDrawState,
  formData: FormData
): Promise<StartDrawState> {
  const roomId = (formData.get("roomId") as string) ?? "";

  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  // 1. Fetch room
  const { data: room } = await (admin as any)
    .from("rooms")
    .select("id, status, host_user_id, assignment_mode")
    .eq("id", roomId)
    .maybeSingle() as {
      data: Pick<RoomPublic, "id" | "status" | "host_user_id" | "assignment_mode"> | null;
    };

  if (!room) return { error: "Room not found." };
  if (room.host_user_id !== user.id) return { error: "Only the host can start the draw." };
  if (room.status !== "lobby") return { error: "Draw has already been started." };

  // 2. Parallel fetch: players + country codes
  const [playersResult, countriesResult] = await Promise.all([
    (admin as any)
      .from("players")
      .select("id, name, assigned_country")
      .eq("room_id", roomId) as Promise<{ data: Pick<Player, "id" | "name" | "assigned_country">[] | null }>,
    (admin as any)
      .from("room_countries")
      .select("country_code, countries:countries(is_knocked_out)")
      .eq("room_id", roomId) as Promise<{ data: { country_code: string }[] | null }>,
  ]);

  const players = playersResult.data ?? [];
  const countryCodes = (countriesResult.data ?? [])
    .filter((country) => {
      const relation = country as {
        countries?: { is_knocked_out?: boolean } | { is_knocked_out?: boolean }[];
      };
      const status = Array.isArray(relation.countries)
        ? relation.countries[0]
        : relation.countries;
      return !status?.is_knocked_out;
    })
    .map((r) => r.country_code);
  const availableCountryCodes = new Set(countryCodes);

  const playerCount = players.length;
  const countryCount = countryCodes.length;

  if (playerCount < 2) return { error: "At least 2 players must join before starting." };
  if (playerCount > countryCount) {
    return { error: "There are more players than countries still in the cup." };
  }

  if (room.assignment_mode === "player_choice") {
    const missingCountry = players.some(
      (player) => !player.assigned_country || !availableCountryCodes.has(player.assigned_country)
    );
    if (missingCountry) return { error: "Every player must choose a country still in the cup before starting." };

    const { error: statusError } = await (admin as any)
      .from("rooms")
      .update({ status: "group_stage", started_at: new Date().toISOString() })
      .eq("id", roomId) as { error: unknown };

    if (statusError) return { error: "Failed to start the room. Please try again." };
    redirect(`/room/${roomId}/group-stage`, RedirectType.replace);
  }

  // 3. Idempotency: if assignments already exist, draw already ran → skip to page
  const alreadyDrawn = players.some((p) => p.assigned_country !== null);
  if (alreadyDrawn) redirect(`/room/${roomId}/draw`, RedirectType.replace);

  // 4. Run secure Fisher-Yates shuffle + assign countries
  const assignments = assignCountries(players, countryCodes);

  // 5. Batch-update players.assigned_country
  const updateResults = await Promise.all(
    assignments.map((a) =>
      (admin as any)
        .from("players")
        .update({ assigned_country: a.countryCode })
        .eq("id", a.playerId) as Promise<{ error: unknown }>
    )
  );

  const updateErrors = updateResults.filter((r) => r.error);
  if (updateErrors.length > 0) {
    return { error: "Failed to save draw assignments. Please try again." };
  }

  // 6. Transition room to 'drawn' — triggers Realtime event for all lobby clients
  const { error: statusError } = await (admin as any)
    .from("rooms")
    .update({ status: "drawn", started_at: new Date().toISOString() })
    .eq("id", roomId) as { error: unknown };

  if (statusError) return { error: "Failed to finalise the draw. Please try again." };

  redirect(`/room/${roomId}/draw`, RedirectType.replace);
}

// ─── startGroupStage ──────────────────────────────────────────────────────────

export type GroupStageState = { error?: string } | null;

/**
 * Room-member action: transitions room from 'drawn' → 'group_stage'.
 * Idempotent — already group_stage → redirect immediately.
 */
export async function startGroupStage(
  prevState: GroupStageState,
  formData: FormData
): Promise<GroupStageState> {
  const roomId = (formData.get("roomId") as string) ?? "";

  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { data: room } = await (admin as any)
    .from("rooms")
    .select("id, status, host_user_id")
    .eq("id", roomId)
    .maybeSingle() as { data: Pick<RoomPublic, "id" | "status" | "host_user_id"> | null };

  if (!room) return { error: "Room not found." };
  const isHost = room.host_user_id === user.id;
  if (!isHost) {
    const { data: player } = await (admin as any)
      .from("players")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle() as { data: Pick<Player, "id"> | null };

    if (!player) return { error: "Only players in this room can enter group stage." };
  }

  if (room.status === "group_stage") redirect(`/room/${roomId}/group-stage`, RedirectType.replace);
  if (room.status !== "drawn") return { error: "Room is not in the drawn state." };

  const { error: updateError } = await (admin as any)
    .from("rooms")
    .update({ status: "group_stage" })
    .eq("id", roomId) as { error: unknown };

  if (updateError) return { error: "Failed to start group stage. Please try again." };

  redirect(`/room/${roomId}/group-stage`, RedirectType.replace);
}

// ─── buildKnockout ────────────────────────────────────────────────────────────

export type BuildKnockoutState = { error?: string } | null;

/**
 * Host-only: transitions room to 'knockout' and sends the host to the
 * bracket-setup page where they will arrange the R16 matchups.
 *
 * room_teams are NOT created here — that happens in saveBracket() after
 * the host has set the matchups.
 * Idempotent: if bracket already set up (room_teams exist) → skip to ladder.
 */
export async function buildKnockout(
  prevState: BuildKnockoutState,
  formData: FormData
): Promise<BuildKnockoutState> {
  const roomId = (formData.get("roomId") as string) ?? "";

  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { data: room } = await (admin as any)
    .from("rooms")
    .select("id, status, host_user_id")
    .eq("id", roomId)
    .maybeSingle() as { data: Pick<RoomPublic, "id" | "status" | "host_user_id"> | null };

  if (!room) return { error: "Room not found." };
  if (room.host_user_id !== user.id) return { error: "Only the host can build the bracket." };

  // Idempotency: bracket already saved → go straight to ladder
  const { data: existingTeams } = await (admin as any)
    .from("room_teams")
    .select("id")
    .eq("room_id", roomId)
    .limit(1) as { data: { id: string }[] | null };

  if (existingTeams && existingTeams.length > 0) {
    redirect(`/room/${roomId}/ladder`);
  }

  if (room.status === "group_stage") {
    // Verify all countries are decided before allowing bracket setup
    const { data: undecided } = await (admin as any)
      .from("room_countries")
      .select("id")
      .eq("room_id", roomId)
      .is("qualified", null) as { data: { id: string }[] | null };

    if (undecided && undecided.length > 0) {
      return { error: `${undecided.length} countries are still undecided.` };
    }

    // Transition to 'knockout' — Realtime fires, all group-stage clients redirect
    const { error: updateError } = await (admin as any)
      .from("rooms")
      .update({ status: "knockout" })
      .eq("id", roomId) as { error: unknown };

    if (updateError) return { error: "Failed to start knockout phase. Please try again." };
  }

  // Send the host to bracket setup (non-host players are handled by group-stage Realtime)
  redirect(`/room/${roomId}/bracket-setup`);
}

// ─── saveBracket ──────────────────────────────────────────────────────────────

export type SaveBracketState = { error?: string } | null;

/**
 * Host-only: saves the R16 bracket that was arranged on the bracket-setup page.
 *
 * Expects formData keys:
 *   roomId
 *   match_N_a, match_N_b  (N = 1..M, each a country code)
 *
 * Creates room_teams rows and match records, then redirects to /ladder.
 */
export async function saveBracket(
  prevState: SaveBracketState,
  formData: FormData
): Promise<SaveBracketState> {
  const roomId = (formData.get("roomId") as string) ?? "";

  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { data: room } = await (admin as any)
    .from("rooms")
    .select("id, status, host_user_id")
    .eq("id", roomId)
    .maybeSingle() as { data: Pick<RoomPublic, "id" | "status" | "host_user_id"> | null };

  if (!room) return { error: "Room not found." };
  if (room.host_user_id !== user.id) return { error: "Only the host can set the bracket." };
  if (room.status !== "knockout") return { error: "Room is not in the knockout phase." };

  // Parse matchup pairs from form data
  const pairs: { teamA: string; teamB: string }[] = [];
  let i = 1;
  while (true) {
    const teamA = (formData.get(`match_${i}_a`) as string) ?? "";
    const teamB = (formData.get(`match_${i}_b`) as string) ?? "";
    if (!teamA || !teamB) break;
    pairs.push({ teamA, teamB });
    i++;
  }

  if (pairs.length < 2) {
    return { error: "Set up at least 2 matches to start the bracket." };
  }

  // Idempotency: room_teams already exist → go straight to ladder
  const { data: existing } = await (admin as any)
    .from("room_teams")
    .select("id").eq("room_id", roomId).limit(1) as { data: { id: string }[] | null };
  if (existing && existing.length > 0) redirect(`/room/${roomId}/ladder`);

  // Fetch alive players for playerMap
  const { data: alivePlayers } = await (admin as any)
    .from("players")
    .select("id, assigned_country")
    .eq("room_id", roomId)
    .eq("is_eliminated", false)
    .not("assigned_country", "is", null) as { data: Pick<Player, "id" | "assigned_country">[] | null };

  const playerMap = new Map<string, string>(
    (alivePlayers ?? []).filter(p => p.assigned_country).map(p => [p.assigned_country!, p.id])
  );

  // Determine starting stage from bracket size
  const totalTeams = pairs.length * 2;
  const startingStage = getStartingStage(totalTeams) as KnockoutStage;

  // Build room_teams inserts: match 1 → positions 1,2; match 2 → positions 3,4; etc.
  const teamInserts = pairs.flatMap((pair, idx) => [
    { room_id: roomId, country_code: pair.teamA, player_id: playerMap.get(pair.teamA) ?? null, bracket_position: idx * 2 + 1, current_stage: startingStage, is_eliminated: false },
    { room_id: roomId, country_code: pair.teamB, player_id: playerMap.get(pair.teamB) ?? null, bracket_position: idx * 2 + 2, current_stage: startingStage, is_eliminated: false },
  ]);

  const { error: teamsError } = await (admin as any)
    .from("room_teams").insert(teamInserts) as { error: unknown };
  if (teamsError) {
    console.error("[saveBracket] room_teams error:", teamsError);
    return { error: "Failed to save bracket teams. Please try again." };
  }

  // Create explicit match records for the first round
  const matchInserts = pairs.map((pair, idx) => ({
    room_id: roomId,
    stage: startingStage as string,
    team_a_code: pair.teamA,
    team_b_code: pair.teamB,
    winner_code: null,
    match_order: idx + 1,
    external_match_id: null,
    bracket_position: null,
  }));

  const { error: matchesError } = await (admin as any)
    .from("matches").insert(matchInserts) as { error: unknown };
  if (matchesError) {
    console.error("[saveBracket] matches error:", matchesError);
    // Non-fatal: room_teams are saved; matches can be derived from positions
  }

  // Auto-eliminate players whose assigned country was NOT placed in the bracket.
  // Example: player had Argentina, but Argentina was knocked out in groups and
  // the host didn't select them for the knockout bracket.
  const bracketCountryCodes = new Set(pairs.flatMap(p => [p.teamA, p.teamB]));
  const eliminatedPlayers = (alivePlayers ?? []).filter(
    p => p.assigned_country && !bracketCountryCodes.has(p.assigned_country)
  );

  if (eliminatedPlayers.length > 0) {
    await Promise.all(
      eliminatedPlayers.map(p =>
        (admin as any)
          .from("players")
          .update({ is_eliminated: true })
          .eq("id", p.id)
      )
    );
  }

  redirect(`/room/${roomId}/ladder`);
}

// ─── advanceMatch ─────────────────────────────────────────────────────────────

export type AdvanceMatchState = { error?: string } | null;

/**
 * Host-only: manually record a knockout match result.
 * Idempotent: no-op if the winner is already at a later stage.
 */
export async function advanceMatch(
  prevState: AdvanceMatchState,
  formData: FormData
): Promise<AdvanceMatchState> {
  const roomId = (formData.get("roomId") as string) ?? "";
  const winnerCode = (formData.get("winnerCode") as string) ?? "";
  const loserCode = (formData.get("loserCode") as string) ?? "";
  const stage = (formData.get("stage") as string) ?? "";

  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { data: room } = await (admin as any)
    .from("rooms")
    .select("id, status, host_user_id")
    .eq("id", roomId)
    .maybeSingle() as { data: Pick<RoomPublic, "id" | "status" | "host_user_id"> | null };

  if (!room) return { error: "Room not found." };
  if (room.host_user_id !== user.id) return { error: "Only the host can advance matches." };
  if (room.status !== "knockout") return { error: "Room is not in the knockout phase." };

  // Fetch both teams
  const [winnerResult, loserResult, allTeamsResult] = await Promise.all([
    (admin as any).from("room_teams").select("id,country_code,bracket_position,current_stage,is_eliminated")
      .eq("room_id", roomId).eq("country_code", winnerCode).maybeSingle() as Promise<{ data: RoomTeam | null }>,
    (admin as any).from("room_teams").select("id,country_code,bracket_position,current_stage,is_eliminated")
      .eq("room_id", roomId).eq("country_code", loserCode).maybeSingle() as Promise<{ data: RoomTeam | null }>,
    (admin as any).from("room_teams").select("id,bracket_position").eq("room_id", roomId) as Promise<{ data: { id: string; bracket_position: number }[] | null }>,
  ]);

  const winner = winnerResult.data;
  const loser = loserResult.data;
  if (!winner || !loser) return { error: "One or both teams not found in this room." };

  const allTeams = allTeamsResult.data ?? [];
  const startingStage = getStartingStage(allTeams.length);

  // Idempotency: skip if winner already advanced past this stage
  const currentStageIdx = STAGE_ORDER.indexOf(winner.current_stage as any);
  const matchStageIdx = STAGE_ORDER.indexOf(stage as any);
  if (currentStageIdx > matchStageIdx) {
    redirect(`/room/${roomId}/ladder`);
  }

  // Compute next stage for the winner
  const posAtThisStage = positionAtStage(winner.bracket_position, stage as any, startingStage);
  const nextInfo = getNextStageInfo(stage as any, posAtThisStage);
  const nextStage: KnockoutStage = nextInfo ? (nextInfo.nextStage as KnockoutStage) : "champion";

  // Advance winner
  await (admin as any).from("room_teams").update({ current_stage: nextStage }).eq("id", winner.id);

  // Eliminate loser
  if (!loser.is_eliminated) {
    await (admin as any).from("room_teams").update({ is_eliminated: true }).eq("id", loser.id);

    const { data: loserPlayer } = await (admin as any)
      .from("players")
      .select("id")
      .eq("room_id", roomId)
      .eq("assigned_country", loserCode)
      .maybeSingle() as { data: { id: string } | null };

    if (loserPlayer) {
      await (admin as any).from("players").update({ is_eliminated: true }).eq("id", loserPlayer.id);
    }
  }

  // Upsert match record
  const matchOrder = Math.ceil(posAtThisStage / 2);
  await (admin as any)
    .from("matches")
    .upsert(
      {
        room_id: roomId,
        stage,
        team_a_code: winnerCode,
        team_b_code: loserCode,
        winner_code: winnerCode,
        match_order: matchOrder,
        external_match_id: null,
      },
      { onConflict: "room_id,stage,match_order", ignoreDuplicates: false }
    );

  // If the winner just became champion, trigger auto-resolution
  if (nextStage === "champion") {
    const resolution = await resolveRoomIfComplete(roomId, admin);
    if (resolution) {
      // Room is now finished — redirect host directly to winner page.
      // Other clients will redirect via the Realtime rooms UPDATE event.
      redirect(`/room/${roomId}/winner`);
    }
  }

  return null; // success — Realtime handles UI update
}
