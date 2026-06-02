"use client";

import { useId } from "react";

interface JoinCodeInputProps {
  value: string;
  onChange: (normalised: string) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * Specialised input for room codes (WC-XXXX format).
 * Auto-uppercases, filters non-alphanumeric chars, limits suffix to 4 chars.
 * Always calls onChange with the full "WC-XXXX" normalised form (or "" if empty).
 */
export function JoinCodeInput({ value, onChange, error, disabled }: JoinCodeInputProps) {
  const id = useId();
  const descId = `${id}-desc`;

  // Derive the editable suffix from the stored value
  const suffix = value.startsWith("WC-") ? value.slice(3) : value;

  function handleChange(raw: string) {
    const cleaned = raw
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 4);
    onChange(cleaned ? `WC-${cleaned}` : "");
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        {/* Fixed WC- prefix */}
        <span className="select-none font-mono text-3xl font-bold tracking-widest text-muted">
          WC-
        </span>

        {/* Editable 4-char suffix */}
        <input
          id={id}
          type="text"
          value={suffix}
          onChange={(e) => handleChange(e.target.value)}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData("text");
            // Handle pasting full "WC-AB23" or just "AB23"
            const stripped = pasted.toUpperCase().replace("WC-", "").replace(/[^A-Z0-9]/g, "").slice(0, 4);
            onChange(stripped ? `WC-${stripped}` : "");
          }}
          placeholder="XXXX"
          maxLength={4}
          disabled={disabled}
          aria-label="Room code suffix (4 characters)"
          aria-describedby={error ? descId : undefined}
          aria-invalid={!!error}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="characters"
          className={[
            "w-32 rounded-xl border bg-surface py-3 text-center font-mono text-3xl font-bold",
            "tracking-[0.3em] text-white placeholder:text-muted/40 outline-none",
            "transition-colors duration-200",
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

      {error && (
        <p id={descId} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
