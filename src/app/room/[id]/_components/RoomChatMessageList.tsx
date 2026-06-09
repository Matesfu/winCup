"use client";

import type { RefObject } from "react";
import { RoomChatBubble } from "./RoomChatBubble";
import type { RoomMessage } from "@/lib/types/database";

interface RoomChatMessageListProps {
  messages: RoomMessage[];
  currentUserId: string;
  hasMore: boolean;
  isLoadingInitial: boolean;
  isLoadingOlder: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  onLoadOlder: () => void;
}

function dayKey(value: string) {
  return new Date(value).toDateString();
}

function dayLabel(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function RoomChatMessageList({
  messages,
  currentUserId,
  hasMore,
  isLoadingInitial,
  isLoadingOlder,
  scrollRef,
  onLoadOlder,
}: RoomChatMessageListProps) {
  return (
    <div
      ref={scrollRef}
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-4"
      aria-live="polite"
    >
      {isLoadingInitial ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted">
          Loading messages…
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="mb-3 text-4xl" aria-hidden="true">💬</div>
          <p className="text-sm font-bold text-white">No messages yet</p>
          <p className="mt-1 text-xs text-muted">
            Say hello, share predictions, or celebrate the draw.
          </p>
        </div>
      ) : (
        <>
          {hasMore && (
            <button
              type="button"
              onClick={onLoadOlder}
              disabled={isLoadingOlder}
              className="mx-auto rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-muted transition hover:border-gold/50 hover:text-gold disabled:opacity-50"
            >
              {isLoadingOlder ? "Loading…" : "Load earlier messages"}
            </button>
          )}

          {messages.map((message, index) => {
            const currentDay = dayKey(message.created_at);
            const previous = messages[index - 1];
            const shouldShowDay =
              !previous || dayKey(previous.created_at) !== currentDay;
            const isOwn = message.sender_user_id === currentUserId;
            const showSender =
              !isOwn &&
              (!previous ||
                previous.sender_user_id !== message.sender_user_id ||
                dayKey(previous.created_at) !== currentDay);

            return (
              <div key={message.id} className="flex flex-col gap-2">
                {shouldShowDay && (
                  <div className="mx-auto rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-muted">
                    {dayLabel(message.created_at)}
                  </div>
                )}
                <RoomChatBubble
                  message={message}
                  isOwn={isOwn}
                  showSender={showSender}
                />
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
