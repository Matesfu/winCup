"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MESSAGE_PAGE_SIZE,
  getRoomChatLastSeenKey,
  isDuplicateMessage,
} from "@/lib/messages";
import { subscribeRoomMessages } from "@/lib/supabase/realtime";
import { RoomChatDrawer } from "./RoomChatDrawer";
import type { RoomMessage } from "@/lib/types/database";

interface RoomChatLauncherProps {
  roomId: string;
  currentUserId: string;
}

interface MessagesResponse {
  messages?: RoomMessage[];
  hasMore?: boolean;
  error?: string;
}

interface SendResponse {
  message?: RoomMessage;
  error?: string;
}

function sortMessages(messages: RoomMessage[]) {
  return [...messages].sort(
    (left, right) =>
      new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  );
}

export function RoomChatLauncher({
  roomId,
  currentUserId,
}: RoomChatLauncherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isOpenRef = useRef(isOpen);
  const hasLoadedRef = useRef(hasLoaded);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    hasLoadedRef.current = hasLoaded;
  }, [hasLoaded]);

  const scrollToBottom = useCallback(() => {
    window.requestAnimationFrame(() => {
      const node = scrollRef.current;
      if (!node) return;
      node.scrollTop = node.scrollHeight;
    });
  }, []);

  const rememberSeen = useCallback(() => {
    try {
      localStorage.setItem(getRoomChatLastSeenKey(roomId), new Date().toISOString());
    } catch {
      // Ignore private-mode storage failures.
    }
  }, [roomId]);

  const upsertMessage = useCallback((message: RoomMessage) => {
    setMessages((current) => {
      if (isDuplicateMessage(current, message.id)) {
        return current.map((item) => (item.id === message.id ? { ...item, ...message } : item));
      }
      return sortMessages([...current, message]);
    });
  }, []);

  const fetchInitialMessages = useCallback(async () => {
    setIsLoadingInitial(true);
    setLoadError(null);

    try {
      const response = await fetch(
        `/api/rooms/${roomId}/messages?limit=${MESSAGE_PAGE_SIZE}`,
        { cache: "no-store" }
      );
      const data = (await response.json()) as MessagesResponse;

      if (!response.ok) {
        setLoadError(data.error ?? "Could not load messages.");
        return;
      }

      setMessages(data.messages ?? []);
      setHasMore(Boolean(data.hasMore));
      setHasLoaded(true);
      setUnreadCount(0);
      rememberSeen();
      scrollToBottom();
    } catch {
      setLoadError("Could not load messages.");
    } finally {
      setIsLoadingInitial(false);
    }
  }, [rememberSeen, roomId, scrollToBottom]);

  const loadOlderMessages = useCallback(async () => {
    const before = messages[0]?.created_at;
    if (!before || isLoadingOlder) return;

    setIsLoadingOlder(true);
    setLoadError(null);

    try {
      const params = new URLSearchParams({
        limit: String(MESSAGE_PAGE_SIZE),
        before,
      });
      const response = await fetch(`/api/rooms/${roomId}/messages?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as MessagesResponse;

      if (!response.ok) {
        setLoadError(data.error ?? "Could not load older messages.");
        return;
      }

      setMessages((current) => {
        const next = [...(data.messages ?? [])];
        for (const message of current) {
          if (!isDuplicateMessage(next, message.id)) next.push(message);
        }
        return sortMessages(next);
      });
      setHasMore(Boolean(data.hasMore));
    } catch {
      setLoadError("Could not load older messages.");
    } finally {
      setIsLoadingOlder(false);
    }
  }, [isLoadingOlder, messages, roomId]);

  const sendMessage = useCallback(
    async (body: string) => {
      setIsSending(true);
      setSendError(null);

      try {
        const response = await fetch(`/api/rooms/${roomId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        });
        const data = (await response.json()) as SendResponse;

        if (!response.ok || !data.message) {
          setSendError(data.error ?? "Could not send message.");
          return false;
        }

        upsertMessage(data.message);
        rememberSeen();
        scrollToBottom();
        return true;
      } catch {
        setSendError("Could not send message.");
        return false;
      } finally {
        setIsSending(false);
      }
    },
    [rememberSeen, roomId, scrollToBottom, upsertMessage]
  );

  const openChat = useCallback(() => {
    setIsOpen(true);
    setUnreadCount(0);
    rememberSeen();

    if (!hasLoadedRef.current && !isLoadingInitial) {
      void fetchInitialMessages();
      return;
    }

    scrollToBottom();
  }, [fetchInitialMessages, isLoadingInitial, rememberSeen, scrollToBottom]);

  useEffect(() => {
    const unsubscribe = subscribeRoomMessages(roomId, {
      onInserted(message) {
        if (hasLoadedRef.current) {
          upsertMessage(message);
          if (isOpenRef.current) scrollToBottom();
        }

        if (!isOpenRef.current && message.sender_user_id !== currentUserId) {
          setUnreadCount((count) => Math.min(count + 1, 99));
        }
      },
      onUpdated(message) {
        if (!message.id) return;
        setMessages((current) =>
          current.map((item) => (item.id === message.id ? { ...item, ...message } : item))
        );
      },
      onDeleted(messageId) {
        setMessages((current) => current.filter((message) => message.id !== messageId));
      },
    });

    return unsubscribe;
  }, [currentUserId, roomId, scrollToBottom, upsertMessage]);

  return (
    <>
      <button
        type="button"
        onClick={openChat}
        className="fixed bottom-6 right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border border-gold/40 bg-gold text-2xl text-black shadow-lift transition hover:scale-105 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background md:bottom-6 md:right-6"
        aria-label="Open room chat"
      >
        <span aria-hidden="true">💬</span>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-6 rounded-full border-2 border-background bg-danger px-1.5 py-0.5 text-center text-[10px] font-black text-white">
            {unreadCount >= 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {loadError && !isOpen && (
        <p className="fixed bottom-24 right-4 z-40 max-w-48 rounded-2xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {loadError}
        </p>
      )}

      <RoomChatDrawer
        isOpen={isOpen}
        messages={messages}
        currentUserId={currentUserId}
        hasMore={hasMore}
        isLoadingInitial={isLoadingInitial}
        isLoadingOlder={isLoadingOlder}
        isSending={isSending}
        sendError={sendError ?? loadError}
        scrollRef={scrollRef}
        onClose={() => setIsOpen(false)}
        onLoadOlder={loadOlderMessages}
        onSend={sendMessage}
      />
    </>
  );
}
