import { NextResponse } from "next/server";
import { createAdminClient, createSessionClient } from "@/lib/supabase/server";
import {
  MESSAGE_RATE_LIMIT_COUNT,
  MESSAGE_RATE_LIMIT_WINDOW_SECONDS,
  normalizeMessageBody,
  parseMessagePageLimit,
  validateMessageBody,
} from "@/lib/messages";
import type { Player, RoomMessage, RoomPublic } from "@/lib/types/database";

interface RouteContext {
  params: Promise<{ id: string }>;
}

type ChatRoom = Pick<RoomPublic, "id" | "host_user_id" | "host_name">;
type ChatPlayer = Pick<Player, "id" | "name" | "avatar_emoji">;
type QueryError = { message?: string } | null;

interface SupabaseQuery<TResult> extends PromiseLike<TResult> {
  select(
    columns: string,
    options?: { count?: "exact"; head?: boolean }
  ): SupabaseQuery<TResult>;
  insert(values: Record<string, unknown>): SupabaseQuery<TResult>;
  eq(column: string, value: string): SupabaseQuery<TResult>;
  gte(column: string, value: string): SupabaseQuery<TResult>;
  lt(column: string, value: string): SupabaseQuery<TResult>;
  order(column: string, options: { ascending: boolean }): SupabaseQuery<TResult>;
  limit(count: number): SupabaseQuery<TResult>;
  maybeSingle(): Promise<TResult>;
  single(): Promise<TResult>;
}

interface MessageAdminClient {
  from<TResult>(table: string): SupabaseQuery<TResult>;
}

const MESSAGE_COLUMNS =
  "id,room_id,sender_user_id,sender_player_id,sender_name,sender_avatar_emoji,body,created_at,deleted_at";

async function getMembership(
  admin: MessageAdminClient,
  roomId: string,
  userId: string
) {
  const [roomResult, playerResult] = await Promise.all([
    admin
      .from("rooms")
      .select("id,host_user_id,host_name")
      .eq("id", roomId)
      .maybeSingle() as Promise<{ data: ChatRoom | null }>,
    admin
      .from("players")
      .select("id,name,avatar_emoji")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle() as Promise<{ data: ChatPlayer | null }>,
  ]);

  const room = roomResult.data;
  if (!room) return { ok: false as const, status: 404, error: "Room not found." };

  const player = playerResult.data;
  const isHost = room.host_user_id === userId;
  if (!isHost && !player) {
    return { ok: false as const, status: 403, error: "Not a room member." };
  }

  return { ok: true as const, room, player, isHost };
}

export async function GET(request: Request, { params }: RouteContext) {
  const { id: roomId } = await params;
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const admin = createAdminClient() as unknown as MessageAdminClient;
  const membership = await getMembership(admin, roomId, user.id);
  if (!membership.ok) {
    return NextResponse.json({ error: membership.error }, { status: membership.status });
  }

  const url = new URL(request.url);
  const limit = parseMessagePageLimit(url.searchParams.get("limit"));
  const before = url.searchParams.get("before");

  let query = admin
    .from<{ data: RoomMessage[] | null; error: QueryError }>("room_messages")
    .select(MESSAGE_COLUMNS)
    .eq("room_id", roomId)
    .order("created_at", { ascending: false });

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data, error } = await query.limit(limit + 1);

  if (error) {
    return NextResponse.json({ error: "Could not load messages." }, { status: 500 });
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const messages = rows.slice(0, limit).reverse();

  return NextResponse.json({ messages, hasMore });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { id: roomId } = await params;
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let payload: { body?: unknown };
  try {
    payload = (await request.json()) as { body?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid message request." }, { status: 400 });
  }

  const validationError = validateMessageBody(payload.body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const body = normalizeMessageBody(payload.body);
  const admin = createAdminClient() as unknown as MessageAdminClient;
  const membership = await getMembership(admin, roomId, user.id);
  if (!membership.ok) {
    return NextResponse.json({ error: membership.error }, { status: membership.status });
  }

  const windowStart = new Date(
    Date.now() - MESSAGE_RATE_LIMIT_WINDOW_SECONDS * 1000
  ).toISOString();
  const { count } = await admin
    .from<{ count: number | null }>("room_messages")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId)
    .eq("sender_user_id", user.id)
    .gte("created_at", windowStart) as { count: number | null };

  if ((count ?? 0) >= MESSAGE_RATE_LIMIT_COUNT) {
    return NextResponse.json(
      { error: "You are sending messages too quickly. Please wait a moment." },
      { status: 429 }
    );
  }

  const senderName = membership.player?.name ?? membership.room.host_name;
  const senderAvatarEmoji = membership.player?.avatar_emoji ?? "🏆";

  const { data: message, error } = await admin
    .from<{ data: RoomMessage | null; error: QueryError }>("room_messages")
    .insert({
      room_id: roomId,
      sender_user_id: user.id,
      sender_player_id: membership.player?.id ?? null,
      sender_name: senderName,
      sender_avatar_emoji: senderAvatarEmoji,
      body,
    })
    .select(MESSAGE_COLUMNS)
    .single();

  if (error || !message) {
    return NextResponse.json({ error: "Could not send message." }, { status: 500 });
  }

  return NextResponse.json({ message }, { status: 201 });
}

export const dynamic = "force-dynamic";
