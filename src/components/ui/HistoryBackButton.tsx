"use client";

import { useRouter } from "next/navigation";

interface HistoryBackButtonProps {
  fallbackHref?: string;
  label?: string;
  className?: string;
}

export function HistoryBackButton({
  fallbackHref = "/dashboard",
  label = "Back",
  className,
}: HistoryBackButtonProps) {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className={[
        "absolute left-4 top-4 inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-surface px-4 py-2 text-sm font-bold text-white transition-colors hover:border-gold/50 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 sm:left-6 sm:top-6",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Go back to the previous page"
    >
      <span aria-hidden="true">←</span>
      {label}
    </button>
  );
}
