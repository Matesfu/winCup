"use client";

import { useEffect, useRef } from "react";

type Variant = "success" | "error" | "info";

interface ToastProps {
  message: string;
  variant?: Variant;
  durationMs?: number;
  onDismiss?: () => void;
}

const variantClasses: Record<Variant, string> = {
  success: "border-success/40 bg-success/15 text-success",
  error:   "border-danger/40 bg-danger/15 text-danger",
  info:    "border-gold/40 bg-gold/10 text-gold",
};

export function Toast({
  message,
  variant = "info",
  durationMs = 3000,
  onDismiss,
}: ToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss?.(), durationMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [durationMs, onDismiss]);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={[
        "animate-slide-up fixed left-1/2 top-4 z-50 -translate-x-1/2",
        "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-lift",
        "max-w-xs text-center",
        variantClasses[variant],
      ].join(" ")}
    >
      {message}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="ml-1 shrink-0 opacity-70 hover:opacity-100"
        >
          ×
        </button>
      )}
    </div>
  );
}
