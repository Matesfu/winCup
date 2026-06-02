/**
 * Core draw logic — pure functions, no Supabase dependency.
 * Safe to call from Server Actions and easy to unit test.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DrawAssignment {
  playerId: string;
  playerName: string;
  countryCode: string;
}

// ─── shuffleSecurely ──────────────────────────────────────────────────────────

/**
 * Cryptographically secure Fisher-Yates shuffle.
 * Uses crypto.getRandomValues — NOT Math.random().
 *
 * Modulo bias is < 0.001% for arrays ≤ 36 elements, negligible for a game.
 * Never mutates the input array.
 */
export function shuffleSecurely<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    const j = bytes[0] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── assignCountries ──────────────────────────────────────────────────────────

/**
 * Assigns exactly one country to each player via a secure shuffle.
 * Throws if the arrays are different lengths — this is a programming error,
 * not a user error, so it should never happen in production.
 */
export function assignCountries(
  players: { id: string; name: string }[],
  countryCodes: string[]
): DrawAssignment[] {
  if (players.length !== countryCodes.length) {
    throw new Error(
      `Player count (${players.length}) must equal country count (${countryCodes.length})`
    );
  }
  const shuffled = shuffleSecurely(countryCodes);
  return players.map((player, i) => ({
    playerId: player.id,
    playerName: player.name,
    countryCode: shuffled[i],
  }));
}

// ─── buildFlagSequence ────────────────────────────────────────────────────────

/**
 * Builds the slot-machine flag sequence for the carousel animation.
 * Returns a shuffled array of flags ending with the target country.
 * The target always appears at the last position so the carousel lands on it.
 */
export function buildFlagSequence(
  allFlags: { code: string; flag_emoji: string }[],
  targetCode: string,
  count = 25
): { code: string; flag_emoji: string }[] {
  const others = allFlags.filter((f) => f.code !== targetCode);
  const shuffled = shuffleSecurely(others);
  const target = allFlags.find((f) => f.code === targetCode);
  if (!target) throw new Error(`Target country ${targetCode} not found in flag list`);
  // Fill with repeated shuffled flags + target at end
  const sequence: { code: string; flag_emoji: string }[] = [];
  while (sequence.length < count - 1) {
    sequence.push(...shuffleSecurely(shuffled));
  }
  return [...sequence.slice(0, count - 1), target];
}
