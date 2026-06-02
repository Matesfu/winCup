"use client";

interface StakeInputProps {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  disabled?: boolean;
}

export function StakeInput({ value, onChange, error, disabled }: StakeInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-white">
        Stake amount{" "}
        <span className="font-normal text-muted">(optional, display only)</span>
      </label>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted">£</span>
        <input
          type="number"
          min="0"
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. 10"
          disabled={disabled}
          className={[
            "w-32 rounded-xl border bg-surface px-4 py-3 text-sm text-white placeholder:text-muted",
            "transition-colors duration-200 outline-none",
            "focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-background",
            error
              ? "border-danger focus:ring-danger"
              : "border-white/10 focus:border-gold",
            disabled ? "cursor-not-allowed opacity-50" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <p className="text-xs text-muted">
        Display only — WinCup does not handle payments.
      </p>
    </div>
  );
}
