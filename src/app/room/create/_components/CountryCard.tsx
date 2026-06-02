"use client";

interface CountryCardProps {
  code: string;
  name: string;
  flagEmoji: string;
  selected: boolean;
  onToggle: (code: string) => void;
  disabled?: boolean;
  knockedOut?: boolean;
}

export function CountryCard({
  code,
  name,
  flagEmoji,
  selected,
  onToggle,
  disabled,
  knockedOut = false,
}: CountryCardProps) {
  const isDisabled = disabled || knockedOut;

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected && !knockedOut}
      aria-label={
        knockedOut
          ? `${name} is knocked out and cannot be selected`
          : `${selected ? "Deselect" : "Select"} ${name}`
      }
      data-testid={`country-card-${code}`}
      disabled={isDisabled}
      onClick={() => onToggle(code)}
      className={[
        "relative flex flex-col items-center gap-1.5 rounded-xl p-3 text-center",
        "border transition-all duration-200 select-none",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        selected && !knockedOut
          ? "border-gold bg-gold/8 shadow-[0_0_0_2px_#FFD700,0_0_12px_0_rgba(255,215,0,0.25)]"
          : knockedOut
            ? "border-danger/20 bg-danger/5"
            : "border-white/8 bg-surface hover:border-white/25 hover:bg-surface",
        isDisabled ? "cursor-not-allowed opacity-55" : "cursor-pointer",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        className={["text-2xl leading-none", knockedOut ? "grayscale" : ""]
          .filter(Boolean)
          .join(" ")}
        aria-hidden="true"
      >
        {flagEmoji}
      </span>
      <span className="w-full truncate text-xs font-medium leading-tight text-white">
        {name}
      </span>
      {knockedOut && (
        <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-danger">
          Out
        </span>
      )}
      {selected && !knockedOut && (
        <span
          aria-hidden="true"
          className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[9px] font-bold text-black"
        >
          ✓
        </span>
      )}
    </button>
  );
}
