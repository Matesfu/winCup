// Stub for next/navigation — not available in Jest jsdom.
export const useRouter = jest.fn(() => ({
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  prefetch: jest.fn(),
  refresh: jest.fn(),
}));

export const usePathname = jest.fn(() => "/");
export const useSearchParams = jest.fn(() => new URLSearchParams());
