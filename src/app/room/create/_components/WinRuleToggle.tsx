"use client";

import type { WinRule } from "@/lib/types/database";

interface WinRuleOption {
  value: WinRule;
  label: string;
  description: string;
  emoji: string;
}

const WIN_RULE_OPTIONS: WinRuleOption[] = [
  {
    value: "last_standing",
    label: "Last Team Standing",
    description:
      "The last player whose country is still alive wins. There is always a winner.",
    emoji: "🏃",
  },
  {
    value: "strict",
    label: "Must Win the Cup",
    description:
      "Your player only wins if their country wins the entire tournament. If the champion has no owner, stakes are returned.",
    emoji: "🏆",
  },
];

interface WinRuleToggleProps {
  value: WinRule;
  onChange: (rule: WinRule) => void;
  disabled?: boolean;
}

export function WinRuleToggle({ value, onChange, disabled }: WinRuleToggleProps) {
  return (
    <div role="radiogroup" aria-label="Win rule" className="grid gap-3 sm:grid-cols-2">
      {WIN_RULE_OPTIONS.map((option) => {
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            data-testid={`win-rule-${option.value}`}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={[
              "flex flex-col gap-2 rounded-xl p-4 text-left transition-all duration-200",
              "border focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isSelected
                ? "border-gold bg-gold/5 shadow-[inset_3px_0_0_#FFD700]"
                : "border-white/10 bg-surface hover:border-white/25",
              disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl" aria-hidden="true">
                {option.emoji}
              </span>
              <span
                className={`text-sm font-semibold ${isSelected ? "text-gold" : "text-white"}`}
              >
                {option.label}
              </span>
              {isSelected && (
                <span className="ml-auto text-gold" aria-hidden="true">
                  ✓
                </span>
              )}
            </div>
            <p className="text-xs leading-relaxed text-muted">
              {option.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}
