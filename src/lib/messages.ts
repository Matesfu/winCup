export const MAX_MESSAGE_LENGTH = 500;
export const MESSAGE_PAGE_SIZE = 50;
export const MAX_MESSAGE_PAGE_SIZE = 50;
export const MESSAGE_RATE_LIMIT_COUNT = 10;
export const MESSAGE_RATE_LIMIT_WINDOW_SECONDS = 30;

export function normalizeMessageBody(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

export function validateMessageBody(value: unknown): string | null {
  const body = normalizeMessageBody(value);

  if (!body) return "Message cannot be empty.";
  if (body.length > MAX_MESSAGE_LENGTH) {
    return `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`;
  }

  return null;
}

export function parseMessagePageLimit(value: string | null): number {
  if (!value) return MESSAGE_PAGE_SIZE;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return MESSAGE_PAGE_SIZE;

  return Math.min(Math.floor(parsed), MAX_MESSAGE_PAGE_SIZE);
}

export function getRoomChatLastSeenKey(roomId: string): string {
  return `wincup:room-chat:last-seen:${roomId}`;
}

export function isDuplicateMessage<TMessage extends { id: string }>(
  messages: TMessage[],
  messageId: string
): boolean {
  return messages.some((message) => message.id === messageId);
}
