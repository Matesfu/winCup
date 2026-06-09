"use client";

import type { RoomMessage } from "@/lib/types/database";

interface RoomChatBubbleProps {
  message: RoomMessage;
  isOwn: boolean;
  showSender: boolean;
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function RoomChatBubble({
  message,
  isOwn,
  showSender,
}: RoomChatBubbleProps) {
  const isDeleted = Boolean(message.deleted_at);

  return (
    <div className={["flex w-full", isOwn ? "justify-end" : "justify-start"].join(" ")}>
      <div
        className={[
          "flex max-w-[82%] gap-2",
          isOwn ? "flex-row-reverse" : "flex-row",
        ].join(" ")}
      >
        {!isOwn && (
          <div className="mt-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-base">
            <span aria-hidden="true">{message.sender_avatar_emoji ?? "💬"}</span>
          </div>
        )}

        <div
          className={[
            "rounded-3xl px-4 py-2.5 shadow-sm",
            isOwn
              ? "rounded-br-md bg-gold text-black"
              : "rounded-bl-md border border-white/8 bg-surface text-white",
            isDeleted ? "opacity-70" : "",
          ].join(" ")}
        >
          {!isOwn && showSender && (
            <p className="mb-1 text-xs font-bold text-gold">
              {message.sender_name}
            </p>
          )}
          <p
            className={[
              "whitespace-pre-wrap break-words text-sm leading-relaxed",
              isDeleted ? "italic" : "",
            ].join(" ")}
          >
            {isDeleted ? "Message deleted" : message.body}
          </p>
          <p
            className={[
              "mt-1 text-right text-[10px] font-medium",
              isOwn ? "text-black/55" : "text-muted",
            ].join(" ")}
          >
            {formatMessageTime(message.created_at)}
          </p>
        </div>
      </div>
    </div>
  );
}
