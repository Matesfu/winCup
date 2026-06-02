import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/database";

type DBSchema = Database["public"];

/**
 * Session-based server client — uses the calling user's auth session (via cookies).
 * For use in Server Components, Server Actions, and Route Handlers.
 */
export async function createSessionClient() {
  const cookieStore = await cookies();

  return createServerClient<Database, "public", DBSchema>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Silently ignored in read-only Server Component context;
            // the middleware handles token refresh.
          }
        },
      },
    }
  );
}

/**
 * Admin (service-role) server client — bypasses RLS.
 * Use ONLY in privileged Server Actions, Route Handlers, and the cron route.
 * Never call from client-side code — `server-only` enforces this at build time.
 *
 * Reads SUPABASE_SERVICE_ROLE_KEY directly from process.env rather than using
 * getServerEnv(), so it does NOT require FOOTBALL_DATA_API_KEY or CRON_SECRET.
 * Those optional keys are only needed by the cron route, not by every Server Action.
 */
export function createAdminClient() {
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseServiceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY environment variable.\n" +
        "Copy .env.example → .env.local and add your Supabase service role key."
    );
  }

  return createServerClient<Database, "public", DBSchema>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseServiceRoleKey,
    {
      cookies: {
        getAll(): { name: string; value: string }[] { return []; },
        setAll(_cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {},
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
