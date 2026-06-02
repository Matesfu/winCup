type Size = "sm" | "md";

interface CountryChipProps {
  code: string;
  name: string;
  flagEmoji: string;
  size?: Size;
  className?: string;
}

/**
 * Display-only pill showing a country's flag and (optionally) name.
 * sm: emoji only — compact, used in dense grids.
 * md: emoji + name — used in lists with more space.
 */
export function CountryChip({
  name,
  flagEmoji,
  size = "md",
  className = "",
}: CountryChipProps) {
  if (size === "sm") {
    return (
      <span
        title={name}
        aria-label={name}
        className={[
          "inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-lg",
          "border border-white/8",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {flagEmoji}
      </span>
    );
  }

  return (
    <span
      aria-label={name}
      className={[
        "inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-surface px-2.5 py-1",
        "text-sm text-white",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span aria-hidden="true">{flagEmoji}</span>
      <span className="max-w-[80px] truncate">{name}</span>
    </span>
  );
}
