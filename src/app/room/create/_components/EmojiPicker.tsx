"use client";

// ALLOWED_AVATARS and AvatarEmoji live in @/lib/constants (no directive) so they
// can be safely imported from both Client Components and Server Actions.
// Re-exported here so existing imports of this component file don't need to change.
export { ALLOWED_AVATARS, type AvatarEmoji } from "@/lib/constants";
import { ALLOWED_AVATARS } from "@/lib/constants";

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  disabled?: boolean;
}

export function EmojiPicker({ value, onChange, disabled }: EmojiPickerProps) {
  return (
    <div role="radiogroup" aria-label="Choose an avatar emoji">
      <div className="flex flex-wrap gap-2">
        {ALLOWED_AVATARS.map((emoji) => {
          const isSelected = value === emoji;
          return (
            <button
              key={emoji}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Avatar: ${emoji}`}
              disabled={disabled}
              onClick={() => onChange(emoji)}
              className={[
                "flex h-10 w-10 items-center justify-center rounded-xl text-xl transition-all duration-200",
                "border focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isSelected
                  ? "ring-gold scale-110 border-gold bg-gold/10"
                  : "border-white/10 bg-surface hover:border-white/30",
                disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {emoji}
            </button>
          );
        })}
      </div>
    </div>
  );
}
