"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { CountryCard } from "./CountryCard";
import type { Country } from "@/lib/types/database";

interface CountryGridProps {
  countries: Pick<Country, "code" | "name" | "flag_emoji" | "is_knocked_out">[];
  selected: Set<string>;
  onToggle: (code: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  error?: string;
  disabled?: boolean;
  minimum?: number;
}

export function CountryGrid({
  countries,
  selected,
  onToggle,
  onSelectAll,
  onClearAll,
  error,
  disabled,
  minimum = 2,
}: CountryGridProps) {
  const [search, setSearch] = useState("");
  const availableCountries = countries.filter((country) => !country.is_knocked_out);

  const filtered = search.trim()
    ? availableCountries.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
      )
    : availableCountries;

  const count = availableCountries.filter((country) => selected.has(country.code)).length;
  const availableCount = availableCountries.length;
  const allAvailableSelected =
    availableCount > 0 &&
    availableCountries.every((country) => selected.has(country.code));
  const meetsMinimum = count >= minimum;
  const bulkSelectLabel = allAvailableSelected
    ? "Clear all countries"
    : "Select all available countries";

  return (
    <div className="flex flex-col gap-3">
      {/* Counter + search row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={meetsMinimum ? "gold" : "default"}>
            Selected: {count} / {availableCount}
          </Badge>
          {!meetsMinimum && count > 0 && (
            <span className="text-xs text-muted">
              {minimum - count} more needed
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row sm:items-center">
          <button
            type="button"
            role="checkbox"
            aria-checked={allAvailableSelected}
            disabled={disabled || availableCount === 0}
            onClick={() => {
              if (allAvailableSelected) onClearAll();
              else onSelectAll();
            }}
            className={[
              "inline-flex h-8 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-bold transition-colors",
              allAvailableSelected
                ? "border-gold/60 bg-gold/10 text-gold"
                : "border-white/10 bg-surface text-muted hover:border-white/25 hover:text-white",
              disabled || availableCount === 0 ? "cursor-not-allowed opacity-50" : "cursor-pointer",
            ]
              .filter(Boolean)
              .join(" ")}
            data-testid="select-all-countries"
          >
            <span
              aria-hidden="true"
              className={[
                "flex size-3.5 items-center justify-center rounded-full border text-[9px]",
                allAvailableSelected
                  ? "border-gold bg-gold text-black"
                  : "border-white/30",
              ].join(" ")}
            >
              {allAvailableSelected ? "✓" : ""}
            </span>
            {bulkSelectLabel}
          </button>
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
          Select at least {minimum} countries that are still in the cup to continue.
        </p>
      )}
    </div>
  );
}
