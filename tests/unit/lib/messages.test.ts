import {
  MAX_MESSAGE_LENGTH,
  getRoomChatLastSeenKey,
  isDuplicateMessage,
  normalizeMessageBody,
  parseMessagePageLimit,
  validateMessageBody,
} from "@/lib/messages";

describe("message helpers", () => {
  it("normalizes whitespace and line endings", () => {
    expect(normalizeMessageBody("  hello\r\nroom  ")).toBe("hello\nroom");
    expect(normalizeMessageBody(null)).toBe("");
  });

  it("rejects empty messages", () => {
    expect(validateMessageBody("   ")).toBe("Message cannot be empty.");
  });

  it("rejects messages over the maximum length", () => {
    expect(validateMessageBody("a".repeat(MAX_MESSAGE_LENGTH + 1))).toContain(
      `${MAX_MESSAGE_LENGTH} characters`
    );
  });

  it("accepts a valid message at the maximum length", () => {
    expect(validateMessageBody("a".repeat(MAX_MESSAGE_LENGTH))).toBeNull();
  });

  it("caps and defaults page limits", () => {
    expect(parseMessagePageLimit(null)).toBe(50);
    expect(parseMessagePageLimit("0")).toBe(50);
    expect(parseMessagePageLimit("abc")).toBe(50);
    expect(parseMessagePageLimit("12")).toBe(12);
    expect(parseMessagePageLimit("500")).toBe(50);
  });

  it("builds a room-scoped localStorage key", () => {
    expect(getRoomChatLastSeenKey("room-1")).toBe(
      "wincup:room-chat:last-seen:room-1"
    );
  });

  it("detects duplicate message ids", () => {
    expect(isDuplicateMessage([{ id: "a" }, { id: "b" }], "b")).toBe(true);
    expect(isDuplicateMessage([{ id: "a" }], "c")).toBe(false);
  });
});
