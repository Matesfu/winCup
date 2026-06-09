"use client";

import { useEffect } from "react";
import { RoomChatComposer } from "./RoomChatComposer";
import { RoomChatMessageList } from "./RoomChatMessageList";
import type { RoomMessage } from "@/lib/types/database";

interface RoomChatDrawerProps {
  isOpen: boolean;
  messages: RoomMessage[];
  currentUserId: string;
  hasMore: boolean;
  isLoadingInitial: boolean;
  isLoadingOlder: boolean;
  isSending: boolean;
  sendError: string | null;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onLoadOlder: () => void;
  onSend: (body: string) => Promise<boolean>;
}

export function RoomChatDrawer({
  isOpen,
  messages,
  currentUserId,
  hasMore,
  isLoadingInitial,
  isLoadingOlder,
  isSending,
  sendError,
  scrollRef,
  onClose,
  onLoadOlder,
  onSend,
}: RoomChatDrawerProps) {
  useEffect(() => {
    if (!isOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-end md:justify-end">
      <button
        type="button"
        aria-label="Close room chat"
        onClick={onClose}
        className="absolute inset-0 bg-black/55"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label="Room chat"
        className="relative flex h-[82svh] w-full max-w-2xl animate-slide-up flex-col overflow-hidden rounded-t-[2rem] border border-white/10 bg-background shadow-lift md:mb-6 md:mr-6 md:h-[620px] md:w-[420px] md:rounded-[2rem]"
      >
        <header className="flex items-center justify-between border-b border-white/8 bg-surface/80 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
              Room Chat
            </p>
            <h2 className="truncate text-base font-extrabold text-white">
              Talk with players
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-background text-xl text-muted transition hover:border-gold/50 hover:text-gold"
            aria-label="Close chat"
          >
            ×
          </button>
        </header>

        <RoomChatMessageList
          messages={messages}
          currentUserId={currentUserId}
          hasMore={hasMore}
          isLoadingInitial={isLoadingInitial}
          isLoadingOlder={isLoadingOlder}
          scrollRef={scrollRef}
          onLoadOlder={onLoadOlder}
        />

        <RoomChatComposer
          isSending={isSending}
          error={sendError}
          onSend={onSend}
        />
      </section>
    </div>
  );
}
