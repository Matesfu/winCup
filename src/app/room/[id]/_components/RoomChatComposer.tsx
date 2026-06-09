"use client";

import { useRef, useState } from "react";
import { MAX_MESSAGE_LENGTH, normalizeMessageBody } from "@/lib/messages";

interface RoomChatComposerProps {
  isSending: boolean;
  error: string | null;
  onSend: (body: string) => Promise<boolean>;
}

export function RoomChatComposer({
  isSending,
  error,
  onSend,
}: RoomChatComposerProps) {
  const [body, setBody] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const normalized = normalizeMessageBody(body);
  const isTooLong = body.length > MAX_MESSAGE_LENGTH;
  const canSend = Boolean(normalized) && !isTooLong && !isSending;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;

    const sent = await onSend(body);
    if (sent) setBody("");
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="border-t border-white/8 bg-background/95 px-3 py-3"
    >
      {error && (
        <p className="mb-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      <div className="flex items-end gap-2 rounded-3xl border border-white/10 bg-surface p-2 focus-within:border-gold/60">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH + 1}
          placeholder="Message the room"
          aria-label="Message the room"
          className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-muted"
        />

        <button
          type="submit"
          disabled={!canSend}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold text-lg font-black text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send message"
        >
          {isSending ? "…" : "➤"}
        </button>
      </div>

      {body.length > 420 && (
        <p
          className={[
            "mt-1 text-right text-[11px]",
            isTooLong ? "text-danger" : "text-muted",
          ].join(" ")}
        >
          {body.length}/{MAX_MESSAGE_LENGTH}
        </p>
      )}
    </form>
  );
}
