"use client";

import { Button } from "@/components/ui/Button";
import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[WinCup] Uncaught error:", error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <div className="text-6xl" aria-hidden="true">⚡</div>
      <h1 className="mt-4 text-3xl font-bold text-white">Something went wrong</h1>
      <p className="mt-3 max-w-sm text-sm text-muted">
        An unexpected error occurred. Try refreshing — if the issue persists,
        come back later.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button onClick={reset} variant="primary">
          Try Again
        </Button>
        <Button href="/" variant="outline">
          Back to Home
        </Button>
      </div>
    </main>
  );
}
