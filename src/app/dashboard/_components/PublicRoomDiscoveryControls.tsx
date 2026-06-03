import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import {
  hasPublicRoomFilters,
  type PublicRoomFilters,
} from "@/lib/public-room-filters";

interface PublicRoomDiscoveryControlsProps {
  filters: PublicRoomFilters;
}

function buildDashboardHref(
  filters: PublicRoomFilters,
  patch: Partial<Record<"q" | "mode" | "sort" | "minStake" | "maxStake" | "from" | "to", string>>
) {
  const params = new URLSearchParams();

  if (filters.search) params.set("q", filters.search);
  if (filters.assignmentMode !== "all") params.set("mode", filters.assignmentMode);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  if (filters.minStake !== null) params.set("minStake", String(filters.minStake));
  if (filters.maxStake !== null) params.set("maxStake", String(filters.maxStake));
  if (filters.dateFrom) params.set("from", filters.dateFrom);
  if (filters.dateTo) params.set("to", filters.dateTo);

  for (const [key, value] of Object.entries(patch)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }

  const query = params.toString();
  return query ? `/dashboard?${query}` : "/dashboard";
}

function FilterChip({
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

export function PublicRoomDiscoveryControls({
  filters,
}: PublicRoomDiscoveryControlsProps) {
  const inputClass =
    "min-h-12 w-full appearance-none rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm leading-6 text-white placeholder:text-muted outline-none transition-colors focus:border-gold focus:ring-1 focus:ring-gold";
  const labelClass = "flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-muted";
  const hasFilters = hasPublicRoomFilters(filters);

  return (
    <div className="flex flex-col gap-5">
      <form method="get" className="rounded-3xl border border-white/8 bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-center">
          <label className="sr-only" htmlFor="public-room-search">
            Search public rooms
          </label>
          <input
            id="public-room-search"
            className={inputClass}
            type="search"
            name="q"
            defaultValue={filters.search}
            placeholder="Search public rooms"
          />

          <label className="sr-only" htmlFor="public-room-sort">
            Sort public rooms
          </label>
          <select
            id="public-room-sort"
            className={inputClass}
            name="sort"
            defaultValue={filters.sort}
          >
            <option value="newest">Newest</option>
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
            <span>Filters and date range</span>
            <span
              aria-hidden="true"
              className="grid size-7 place-items-center rounded-full bg-white/5 text-gold transition-transform duration-200 group-open:rotate-180"
            >
              ⌄
            </span>
          </summary>
          <div className="mt-4 grid gap-3 md:grid-cols-12">
            <label className={`${labelClass} md:col-span-3`}>
              Mode
              <select className={inputClass} name="mode" defaultValue={filters.assignmentMode}>
                <option value="all">All</option>
                <option value="random">Random</option>
                <option value="player_choice">Player choice</option>
              </select>
            </label>
            <label className={`${labelClass} md:col-span-3`}>
              Min stake
              <input
                className={inputClass}
                type="number"
                min="0"
                step="1"
                name="minStake"
                defaultValue={filters.minStake ?? ""}
                placeholder="0"
              />
            </label>
            <label className={`${labelClass} md:col-span-3`}>
              Max stake
              <input
                className={inputClass}
                type="number"
                min="0"
                step="1"
                name="maxStake"
                defaultValue={filters.maxStake ?? ""}
                placeholder="Any"
              />
            </label>
            <label className={`${labelClass} md:col-span-3`}>
              From
              <input className={inputClass} type="date" name="from" defaultValue={filters.dateFrom} />
            </label>
            <label className={`${labelClass} md:col-span-3`}>
              To
              <input className={inputClass} type="date" name="to" defaultValue={filters.dateTo} />
            </label>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end md:col-span-9">
              <Button type="submit" variant="primary" size="sm" className="min-h-12 rounded-2xl">
                Apply filters
              </Button>
              {hasFilters && (
                <Button href="/dashboard" variant="ghost" size="sm" className="min-h-12 rounded-2xl">
                  Reset
                </Button>
              )}
            </div>
          </div>
        </details>
      </form>

      <div className="rounded-3xl border border-white/8 bg-surface/60 p-3">
        <div className="flex gap-2 overflow-x-auto px-1 pb-4 pt-1">
          <FilterChip
            href={buildDashboardHref(filters, { mode: "" })}
            active={filters.assignmentMode === "all"}
          >
            All rooms
          </FilterChip>
          <FilterChip
            href={buildDashboardHref(filters, { mode: "random" })}
            active={filters.assignmentMode === "random"}
          >
            Random
          </FilterChip>
          <FilterChip
            href={buildDashboardHref(filters, { mode: "player_choice" })}
            active={filters.assignmentMode === "player_choice"}
          >
            Player choice
          </FilterChip>
          <FilterChip
            href={buildDashboardHref(filters, { sort: "stake_low" })}
            active={filters.sort === "stake_low"}
          >
            Low stake
          </FilterChip>
          <FilterChip
            href={buildDashboardHref(filters, { sort: "stake_high" })}
            active={filters.sort === "stake_high"}
          >
            High stake
          </FilterChip>
        </div>
      </div>
    </div>
  );
}
