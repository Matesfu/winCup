import { NextResponse } from "next/server";
import { createAdminClient, createSessionClient } from "@/lib/supabase/server";
import type { Player, RoomPublic } from "@/lib/types/database";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface SupabaseReadQuery<TResult = { data: unknown }> extends PromiseLike<TResult> {
  select(columns: string): SupabaseReadQuery<TResult>;
  eq(column: string, value: string): SupabaseReadQuery<TResult>;
  order(column: string, options: { ascending: boolean }): SupabaseReadQuery<TResult>;
  maybeSingle(): Promise<TResult>;
}

interface SupabaseAdminReader {
  from(table: string): SupabaseReadQuery;
}

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: RouteContext) {
  const { id: roomId } = await params;
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const admin = createAdminClient() as unknown as SupabaseAdminReader;

  const [roomResult, membershipResult] = await Promise.all([
    admin
      .from("rooms")
      .select("id,status,host_user_id")
      .eq("id", roomId)
      .maybeSingle() as unknown as Promise<{
        data: Pick<RoomPublic, "id" | "status" | "host_user_id"> | null;
      }>,
    admin
      .from("players")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle() as unknown as Promise<{ data: Pick<Player, "id"> | null }>,
  ]);

  const room = roomResult.data;
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  const isHost = room.host_user_id === user.id;
  const isRoomPlayer = Boolean(membershipResult.data);

  if (!isHost && !isRoomPlayer) {
    return NextResponse.json({ error: "Not a room member." }, { status: 403 });
  }

  const playersResult = await admin
    .from("players")
    .select("id,room_id,user_id,name,avatar_emoji,assigned_country,is_eliminated,joined_at")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true }) as unknown as { data: Player[] | null };

  return NextResponse.json({
    room: { status: room.status },
    players: playersResult.data ?? [],
  });
}
