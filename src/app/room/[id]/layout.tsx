import { notFound } from "next/navigation";
import { createAdminClient, createSessionClient } from "@/lib/supabase/server";
import { HistoryBackButton } from "@/components/ui/HistoryBackButton";
import { RoomChatLauncher } from "./_components/RoomChatLauncher";
import type { Player, RoomPublic } from "@/lib/types/database";

interface RoomLayoutProps {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

interface SupabaseQuery<TResult> extends PromiseLike<TResult> {
  select(columns: string): SupabaseQuery<TResult>;
  eq(column: string, value: string): SupabaseQuery<TResult>;
  maybeSingle(): Promise<TResult>;
}

interface SupabaseReader {
  from<TResult>(table: string): SupabaseQuery<TResult>;
}

export default async function RoomLayout({ params, children }: RoomLayoutProps) {
  const { id } = await params;
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If not authenticated, render children without the room header.
  if (!user) {
    return <div className="flex min-h-full flex-col">{children}</div>;
  }

  // Lightweight fetch for the header and room-scoped chat access.
  const db = supabase as unknown as SupabaseReader;
  const admin = createAdminClient() as unknown as SupabaseReader;
  const [roomResult, playerResult] = await Promise.all([
    db
      .from<{
        data: Pick<RoomPublic, "code" | "host_name" | "host_user_id" | "status"> | null;
      }>("rooms")
      .select("code, host_name, host_user_id, status")
      .eq("id", id)
      .maybeSingle(),
    admin
      .from<{ data: Pick<Player, "id"> | null }>("players")
      .select("id")
      .eq("room_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const room = roomResult.data;

  if (!room) notFound();
  const canChat = room.host_user_id === user.id || Boolean(playerResult.data);

  return (
    <div className="flex min-h-full flex-col">
      {/* Sticky room header */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <HistoryBackButton fallbackHref="/dashboard" placement="inline" />

          <div className="flex min-w-0 items-center gap-2">
            <span className="mr-1 shrink-0 text-lg font-extrabold text-gold" aria-hidden="true">
              🏆
            </span>
            <span className="shrink-0 font-mono text-sm font-bold text-gold">
              {room.code}
            </span>
            <span className="text-muted text-xs" aria-hidden="true">·</span>
            <span className="truncate text-xs text-muted">
              {room.host_name}&apos;s room
            </span>
          </div>
        </div>
      </header>

      {/* Page content */}
      <div className="flex flex-1 flex-col">{children}</div>
      {canChat && <RoomChatLauncher roomId={id} currentUserId={user.id} />}
    </div>
  );
}
