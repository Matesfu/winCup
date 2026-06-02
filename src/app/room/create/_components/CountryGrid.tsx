"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { CountryCard } from "./CountryCard";
import type { Country } from "@/lib/types/database";

interface CountryGridProps {
  countries: Pick<Country, "code" | "name" | "flag_emoji">[];
  selected: Set<string>;
  onToggle: (code: string) => void;
  error?: string;
  disabled?: boolean;
}

export function CountryGrid({
  countries,
  selected,
  onToggle,
  error,
  disabled,
}: CountryGridProps) {
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? countries.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
      )
    : countries;

  const count = selected.size;
  const meetsMinimum = count >= 4;

  return (
    <div className="flex flex-col gap-3">
      {/* Counter + search row */}
      <div className="flex items-center gap-3">
        <Badge variant={meetsMinimum ? "gold" : "default"}>
          Selected: {count} / {countries.length}
        </Badge>
        {!meetsMinimum && count > 0 && (
          <span className="text-xs text-muted">
            {4 - count} more needed
          </span>
        )}
        <div className="ml-auto">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            disabled={disabled}
            className="h-8 rounded-lg border border-white/10 bg-surface px-3 text-xs text-white placeholder:text-muted outline-none focus:border-gold focus:ring-1 focus:ring-gold disabled:opacity-50"
          />
        </div>
      </div>

      {/* Country grid */}
      <div
        role="group"
        aria-label="Select countries"
        className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6"
      >
        {filtered.map((country) => (
          <CountryCard
            key={country.code}
            code={country.code}
            name={country.name}
            flagEmoji={country.flag_emoji}
            selected={selected.has(country.code)}
            onToggle={onToggle}
            disabled={disabled}
          />
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full py-6 text-center text-sm text-muted">
            No countries match &ldquo;{search}&rdquo;
          </p>
        )}
      </div>

      {/* Minimum requirement hint */}
      {error && (
        <p className="text-xs text-danger">{error}</p>
      )}
      {!error && !meetsMinimum && (
        <p className="text-xs text-muted">
          Select at least 4 countries to continue.
        </p>
      )}
    </div>
  );
}
