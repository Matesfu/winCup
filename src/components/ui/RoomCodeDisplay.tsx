"use client";

import { useState } from "react";

interface RoomCodeDisplayProps {
  code: string;
  className?: string;
}

export function RoomCodeDisplay({ code, className = "" }: RoomCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
    }
  }

  const whatsappText = encodeURIComponent(
    `Join my WinCup room! Code: ${code} — https://wincup.app`
  );

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {/* Large code display */}
      <div className="flex items-center gap-3 rounded-2xl border border-gold/30 bg-gold/5 px-6 py-4">
        <span
          data-testid="room-code-text"
          className="tabular-nums font-mono text-3xl font-extrabold tracking-[0.2em] text-gold sm:text-4xl"
        >
          {code}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy room code"
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-surface px-3 py-2 text-xs font-medium text-white transition-colors hover:border-gold/40 hover:text-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          {copied ? (
            <>
              <svg className="h-3.5 w-3.5 text-success" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
              </svg>
              <span className="text-success">Copied!</span>
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" />
                <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
              </svg>
              Copy code
            </>
          )}
        </button>

        <a
          href={`https://wa.me/?text=${whatsappText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-surface px-3 py-2 text-xs font-medium text-white transition-colors hover:border-success/40 hover:text-success focus:outline-none focus-visible:ring-2 focus-visible:ring-success"
        >
          <span aria-hidden="true">📲</span>
          Share
        </a>
      </div>
    </div>
  );
}
