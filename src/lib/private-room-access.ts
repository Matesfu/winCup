export const PRIVATE_ROOM_JOIN_COOKIE_MAX_AGE = 30 * 60;

export function getPrivateRoomJoinCookieName(roomId: string): string {
  return `wincup_join_${roomId}`;
}

export function normalizeRoomCode(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/\s/g, "");
  const suffix = cleaned.startsWith("WC-")
    ? cleaned.slice(3)
    : cleaned.startsWith("WC")
      ? cleaned.slice(2)
      : cleaned;

  return `WC-${suffix}`;
}
