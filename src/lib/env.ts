import "server-only";

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
        `Copy .env.example → .env.local and fill in the value.`
    );
  }
  return val;
}

/**
 * Server-only environment variables. Called lazily per-request so tests
 * can set process.env values before the first call.
 *
 * Importing this module from a Client Component is a build-time error
 * (enforced by the "server-only" package).
 */
export function getServerEnv() {
  return {
    supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    footballDataApiKey: requireEnv("FOOTBALL_DATA_API_KEY"),
    cronSecret: requireEnv("CRON_SECRET"),
  };
}

/**
 * Public environment variables. Safe to import anywhere.
 * Next.js validates NEXT_PUBLIC_* values at build time.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};
