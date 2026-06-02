// Stub for next/headers — not available in the Jest jsdom environment.
// Real implementation is used in server-side Next.js contexts only.

export const cookies = jest.fn(() => ({
  getAll: jest.fn(() => [] as { name: string; value: string }[]),
  set: jest.fn(),
}));

export const headers = jest.fn(() => new Map<string, string>());
