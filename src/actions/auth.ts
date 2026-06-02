"use server";

import { redirect } from "next/navigation";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { Validation } from "@/lib/validation";
import type { Profile } from "@/lib/types/database";

// NOTE: Supabase @supabase/postgrest-js 2.106.x has a known type inference regression
// with TypeScript 5.9 — conditional types in insert/select signatures resolve to `never`.
// We use `(client as any).from(...)` casts and re-type the results explicitly.
// This is the accepted production workaround; the runtime behaviour is fully correct.

// ─── Shared types ──────────────────────────────────────────────────────────────

export type SignUpState = {
  errors?: {
    username?: string;
    email?: string;
    password?: string;
    form?: string;
  };
  message?: string;
} | null;

export type SignInState = {
  error?: string;
} | null;

// ─── Safe redirect validation ──────────────────────────────────────────────────

function safeRedirect(redirectTo: string | null | undefined): string {
  if (!redirectTo) return "/room/create";
  if (redirectTo.startsWith("/") && !redirectTo.includes("://"))
    return redirectTo;
  return "/room/create";
}

// ─── signUp ────────────────────────────────────────────────────────────────────

export async function signUp(
  prevState: SignUpState,
  formData: FormData
): Promise<SignUpState> {
  const username = (formData.get("username") as string) ?? "";
  const email = (formData.get("email") as string) ?? "";
  const password = (formData.get("password") as string) ?? "";
  const redirectTo = formData.get("redirectTo") as string | null;

  // 1. Validate fields
  const usernameError = Validation.username(username);
  const emailError = Validation.email(email);
  const passwordError = Validation.password(password);

  if (usernameError || emailError || passwordError) {
    return {
      errors: {
        ...(usernameError && { username: usernameError }),
        ...(emailError && { email: emailError }),
        ...(passwordError && { password: passwordError }),
      },
    };
  }

  const supabase = await createSessionClient();

  // 2. Check username uniqueness
  const { data: existing } = await (supabase as any)
    .from("profiles")
    .select("id")
    .eq("username", username.trim())
    .maybeSingle() as { data: Pick<Profile, "id"> | null; error: unknown };

  if (existing) {
    return { errors: { username: "Username already taken" } };
  }

  // 3. Create Supabase Auth user
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email: email.trim(),
    password,
  });

  if (signUpError || !authData.user) {
    const msg = signUpError?.message ?? "";
    if (
      msg.toLowerCase().includes("already registered") ||
      msg.toLowerCase().includes("email address is already taken")
    ) {
      return { errors: { email: "An account with this email already exists" } };
    }
    return { errors: { form: "Could not create account. Please try again." } };
  }

  // 4. Insert profile (admin client — handles both confirmed + unconfirmed users)
  const admin = createAdminClient();
  const { error: profileError } = await (admin as any)
    .from("profiles")
    .insert({ id: authData.user.id, username: username.trim() }) as { error: { code?: string } | null };

  if (profileError) {
    if (profileError.code === "23505") {
      return { errors: { username: "Username already taken" } };
    }
    return {
      errors: {
        form: "Account created but profile setup failed. Please contact support.",
      },
    };
  }

  // 5a. Email confirmation required
  if (!authData.session) {
    return {
      message:
        "Account created! Check your email to confirm your address, then sign in.",
    };
  }

  // 5b. No confirmation needed — redirect
  redirect(safeRedirect(redirectTo));
}

// ─── signIn ────────────────────────────────────────────────────────────────────

export async function signIn(
  prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const identifier = ((formData.get("identifier") as string) ?? "").trim();
  const password = (formData.get("password") as string) ?? "";
  const redirectTo = formData.get("redirectTo") as string | null;

  if (!identifier || !password) {
    return { error: "All fields are required" };
  }

  let email: string;

  if (identifier.includes("@")) {
    email = identifier;
  } else {
    // Username lookup via SECURITY DEFINER function (service role required)
    const admin = createAdminClient();
    const { data: lookedUp } = await (admin as any).rpc(
      "lookup_email_by_username",
      { p_username: identifier }
    ) as { data: string | null; error: unknown };
    // Fall through with identifier if not found — Supabase will give generic auth error
    email = lookedUp ?? identifier;
  }

  const supabase = await createSessionClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return { error: "Invalid username/email or password" };
  }

  redirect(safeRedirect(redirectTo));
}

// ─── signOut ───────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect("/");
}
