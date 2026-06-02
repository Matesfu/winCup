import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";

/**
 * GET /auth/callback?code=<code>&redirectTo=/dashboard
 *
 * Handles the one-click email confirmation link sent by Supabase.
 * Exchanges the code for a session, then redirects to the intended destination.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawRedirect = searchParams.get("redirectTo");

  // Validate redirectTo to prevent open-redirect attacks
  const redirectTo =
    rawRedirect && rawRedirect.startsWith("/") && !rawRedirect.includes("://")
      ? rawRedirect
      : "/dashboard";

  if (code) {
    const supabase = await createSessionClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/?error=auth_failed", origin));
    }
  }

  return NextResponse.redirect(new URL(redirectTo, origin));
}
