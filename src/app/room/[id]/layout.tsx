import { notFound } from "next/navigation";
import Link from "next/link";
import { createSessionClient } from "@/lib/supabase/server";
import type { RoomPublic } from "@/lib/types/database";

interface RoomLayoutProps {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

export default async function RoomLayout({ params, children }: RoomLayoutProps) {
  const { id } = await params;
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If not authenticated, render children without the room header.
  if (!user) {
    return <div className="flex min-h-full flex-col">{children}</div>;
  }

  // Lightweight fetch for the header — 3 columns only
  const { data: room } = await (supabase as any)
    .from("rooms")
    .select("code, host_name, status")
    .eq("id", id)
    .maybeSingle() as { data: Pick<RoomPublic, "code" | "host_name" | "status"> | null };

  if (!room) notFound();

  return (
    <div className="flex min-h-full flex-col">
      {/* Sticky room header */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            {/* WinCup logo → back to dashboard */}
            <Link
              href="/dashboard"
              className="mr-1 shrink-0 text-lg text-gold font-extrabold hover:opacity-80 transition-opacity"
              aria-label="Back to dashboard"
            >
              🏆
            </Link>
            <span className="font-mono text-sm font-bold text-gold shrink-0">
              {room.code}
            </span>
            <span className="text-muted text-xs" aria-hidden="true">·</span>
            <span className="truncate text-xs text-muted">
              {room.host_name}&apos;s room
            </span>
          </div>

          {/* ← Dashboard — navigate away without signing out */}
          <Link
            href="/dashboard"
            className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-white/25 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      {/* Page content */}
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
