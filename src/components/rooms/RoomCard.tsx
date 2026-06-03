import Link from "next/link";
import {
  ROOM_STATUS_COLOR,
  ROOM_STATUS_LABEL,
  createdDateLabel,
  formatAssignmentMode,
  roomRoute,
  type RoomListItem,
} from "@/lib/room-list";

interface RoomCardProps {
  room: RoomListItem;
}

function roleLabel(role: RoomListItem["userRole"]) {
  if (role === "host") return "Host";
  if (role === "player") return "Joined";
  return "Public";
}

function roleClass(role: RoomListItem["userRole"]) {
  if (role === "host") return "bg-gold/15 text-gold";
  if (role === "player") return "bg-blue-500/15 text-blue-300";
  return "bg-success/15 text-success";
}

export function RoomCard({ room }: RoomCardProps) {
  const statusLabel = ROOM_STATUS_LABEL[room.status];
  const statusColor = ROOM_STATUS_COLOR[room.status];
  const route = room.userRole === "public" ? `/room/${room.id}/join` : roomRoute(room);
  const cta = room.userRole === "public"
    ? "Join Room"
    : room.status === "finished"
      ? "View Results"
      : "Enter Room";

  return (
    <article
      className="group relative flex flex-col gap-4 rounded-3xl border border-white/8 bg-surface p-4 transition-all hover:border-gold/30 sm:flex-row sm:items-center sm:gap-5"
      data-testid="room-card"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-extrabold text-white">
              {room.room_name}
            </h3>
            <p className="font-mono text-xs font-extrabold tracking-wider text-gold">
              {room.code}
            </p>
          </div>
          {room.stake_amount !== null && (
            <div className="shrink-0 rounded-2xl bg-gold/10 px-3 py-2 text-right">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                Stake
              </p>
              <p className="text-sm font-black text-gold">{room.stake_amount} Birr</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${statusColor}`}>
            {statusLabel}
          </span>
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${roleClass(room.userRole)}`}>
            {roleLabel(room.userRole)}
          </span>
          <span className="inline-flex items-center rounded-full bg-white/8 px-2.5 py-1 text-[11px] font-semibold text-muted">
            {formatAssignmentMode(room.assignment_mode)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-muted sm:flex sm:flex-wrap sm:gap-x-4">
          <span>👤 {room.host_name}</span>
          <span>👥 {room.playerCount}/{room.countryCount} players</span>
          <span>{room.win_rule === "strict" ? "🏆 Must Win" : "⚔️ Last Standing"}</span>
          <span>Created {createdDateLabel(room.created_at)}</span>
        </div>

        {room.status === "finished" && room.winner_player_id && (
          <p className="text-xs font-semibold text-success">✓ Game complete</p>
        )}
        {room.status === "finished" && !room.winner_player_id && (
          <p className="text-xs font-semibold text-muted">Stakes returned</p>
        )}
      </div>

      <Link
        href={route}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-gold/40 bg-gold/5 px-4 py-3 text-sm font-bold text-gold transition-all hover:border-gold hover:bg-gold/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:w-auto"
      >
        {cta}
        <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}
