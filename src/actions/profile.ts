"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createSessionClient } from "@/lib/supabase/server";
import { Validation } from "@/lib/validation";
import type { Profile } from "@/lib/types/database";

export type UpdateProfileState = {
  errors?: {
    username?: string;
    form?: string;
  };
  success?: string;
} | null;

export type UpdatePasswordState = {
  errors?: {
    password?: string;
    form?: string;
  };
  success?: string;
} | null;

interface SupabaseQuery<TResult> extends PromiseLike<TResult> {
  select(columns: string): SupabaseQuery<TResult>;
  eq(column: string, value: string): SupabaseQuery<TResult>;
  ilike(column: string, pattern: string): SupabaseQuery<TResult>;
  update(values: Record<string, string>): SupabaseQuery<TResult>;
  maybeSingle(): Promise<TResult>;
}

interface SupabaseProfileReader {
  from<TResult>(table: string): SupabaseQuery<TResult>;
}

export async function updateProfile(
  _prevState: UpdateProfileState,
  formData: FormData
): Promise<UpdateProfileState> {
  const username = ((formData.get("username") as string) ?? "").trim();
  const usernameError = Validation.username(username);
  if (usernameError) return { errors: { username: usernameError } };

  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { errors: { form: "Not authenticated." } };

  const admin = createAdminClient() as unknown as SupabaseProfileReader;
  const sessionDb = supabase as unknown as SupabaseProfileReader;

  const { data: existing } = await admin
    .from<{ data: Pick<Profile, "id"> | null }>("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();

  if (existing && existing.id !== user.id) {
    return { errors: { username: "Username already taken" } };
  }

  const { error } = await sessionDb
    .from<{ error: { code?: string; message?: string } | null }>("profiles")
    .update({ username })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") {
      return { errors: { username: "Username already taken" } };
    }
    return { errors: { form: "Could not update profile. Please try again." } };
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath("/my-rooms");
  return { success: "Profile updated." };
}

export async function updatePassword(
  _prevState: UpdatePasswordState,
  formData: FormData
): Promise<UpdatePasswordState> {
  const password = (formData.get("password") as string) ?? "";
  const passwordError = Validation.password(password);
  if (passwordError) return { errors: { password: passwordError } };

  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { errors: { form: "Not authenticated." } };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { errors: { form: "Could not update password. Please try again." } };

  return { success: "Password updated." };
}
