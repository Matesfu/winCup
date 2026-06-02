// Charset excludes visually ambiguous characters: 0/O, 1/I/L
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 chars

/**
 * Generates a short, human-readable room code in the format "WC-XXXX".
 * Uses crypto.getRandomValues for cryptographic randomness — not Math.random().
 * Ambiguous characters (0, O, 1, I, L) excluded to prevent read-aloud confusion.
 */
export function generateRoomCode(): string {
  const bytes = new Uint32Array(4);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes)
    .map((b) => CHARSET[b % CHARSET.length])
    .join("");
  return `WC-${suffix}`;
}

/** Validates a room code string matches the expected format. */
export function isValidRoomCode(code: string): boolean {
  return /^WC-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/.test(code);
}
