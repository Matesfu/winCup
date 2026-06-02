/**
 * Shared constants — no "use client" or "use server" directive.
 * Safe to import from both Client Components and Server Actions.
 *
 * Keeping static data here prevents the Next.js App Router
 * "Client Reference proxy" issue that arises when a Server Action
 * imports a constant that lives inside a "use client" file.
 */

export const ALLOWED_AVATARS = [
  "🏆", "⚽", "🎯", "🏃", "🦁",
  "🦅", "🐉", "🌟", "🔥", "💪",
  "🎪", "🏅", "👑", "⚡", "🎭",
  "🌈", "🦊", "🐺", "🦋", "🎸",
] as const;

export type AvatarEmoji = (typeof ALLOWED_AVATARS)[number];
