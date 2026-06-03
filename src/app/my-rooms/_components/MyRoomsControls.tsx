import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { hasMyRoomFilters, type MyRoomFilters } from "@/lib/my-room-filters";

interface MyRoomsControlsProps {
  filters: MyRoomFilters;
}

type PatchKey = "q" | "role" | "status" | "mode" | "sort";

function buildMyRoomsHref(
  filters: MyRoomFilters,
  patch: Partial<Record<PatchKey, string>>
) {
  const params = new URLSearchParams();

  if (filters.search) params.set("q", filters.search);
  if (filters.role !== "all") params.set("role", filters.role);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.assignmentMode !== "all") params.set("mode", filters.assignmentMode);
  if (filters.sort !== "recent") params.set("sort", filters.sort);

  for (const [key, value] of Object.entries(patch)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }

  const query = params.toString();
  return query ? `/my-rooms?${query}` : "/my-rooms";
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={[
        "inline-flex shrink-0 items-center rounded-full border px-3 py-2 text-xs font-bold transition-colors",
        active
          ? "border-gold/60 bg-gold/15 text-gold"
          : "border-white/10 bg-surface text-muted hover:border-white/20 hover:text-white",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

export function MyRoomsControls({ filters }: MyRoomsControlsProps) {
  const inputClass =
    "min-h-12 w-full appearance-none rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm leading-6 text-white placeholder:text-muted outline-none transition-colors focus:border-gold focus:ring-1 focus:ring-gold";
  const labelClass = "flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-muted";
  const hasFilters = hasMyRoomFilters(filters);

  return (
    <div className="flex w-full min-w-0 flex-col gap-5">
      <form method="get" className="w-full min-w-0 rounded-3xl border border-white/8 bg-surface p-4">
        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-center">
          <label className="sr-only" htmlFor="my-room-search">
            Search my rooms
          </label>
          <input
            id="my-room-search"
            className={inputClass}
            type="search"
            name="q"
            defaultValue={filters.search}
            placeholder="Search room name or code"
          />
          <label className="sr-only" htmlFor="my-room-sort">
            Sort my rooms
          </label>
          <select
            id="my-room-sort"
            className={inputClass}
            name="sort"
            defaultValue={filters.sort}
          >
            <option value="recent">Recent</option>
            <option value="oldest">Oldest</option>
            <option value="stake_high">Stake high</option>
            <option value="stake_low">Stake low</option>
          </select>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            className="min-h-12 w-full rounded-2xl sm:w-auto sm:px-7"
          >
            Search
          </Button>
        </div>

        <details className="group mt-4">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60">
            <span>More filters</span>
            <span
              aria-hidden="true"
              className="grid size-7 place-items-center rounded-full bg-white/5 text-gold transition-transform duration-200 group-open:rotate-180"
            >
              ⌄
            </span>
          </summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className={labelClass}>
              Role
              <select className={inputClass} name="role" defaultValue={filters.role}>
                <option value="all">All</option>
                <option value="host">Hosted</option>
                <option value="player">Joined</option>
              </select>
            </label>
            <label className={labelClass}>
              Status
              <select className={inputClass} name="status" defaultValue={filters.status}>
                <option value="all">All</option>
                <option value="waiting">Waiting</option>
                <option value="active">Active</option>
                <option value="finished">Finished</option>
                <option value="group_stage">Group Stage</option>
                <option value="knockout">Knockout</option>
              </select>
            </label>
            <label className={labelClass}>
              Mode
              <select className={inputClass} name="mode" defaultValue={filters.assignmentMode}>
                <option value="all">All</option>
                <option value="random">Random</option>
                <option value="player_choice">Player choice</option>
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button type="submit" variant="primary" size="sm" className="min-h-12 rounded-2xl">
              Apply
            </Button>
            {hasFilters && (
              <Button href="/my-rooms" variant="ghost" size="sm" className="min-h-12 rounded-2xl">
                Reset
              </Button>
            )}
          </div>
        </details>
      </form>

      <div className="w-full min-w-0 rounded-3xl border border-white/8 bg-surface/60 p-3">
        <div className="flex max-w-full gap-2 overflow-x-auto px-1 pb-4 pt-1">
          <Chip href={buildMyRoomsHref(filters, { role: "" })} active={filters.role === "all"}>
            All
          </Chip>
          <Chip href={buildMyRoomsHref(filters, { role: "host" })} active={filters.role === "host"}>
            Hosted
          </Chip>
          <Chip
            href={buildMyRoomsHref(filters, { role: "player" })}
            active={filters.role === "player"}
          >
            Joined
          </Chip>
          <Chip
            href={buildMyRoomsHref(filters, { status: "waiting" })}
            active={filters.status === "waiting"}
          >
            Waiting
          </Chip>
          <Chip
            href={buildMyRoomsHref(filters, { status: "active" })}
            active={filters.status === "active"}
          >
            Active
          </Chip>
          <Chip
            href={buildMyRoomsHref(filters, { status: "finished" })}
            active={filters.status === "finished"}
          >
            Finished
          </Chip>
        </div>
      </div>
    </div>
  );
}
