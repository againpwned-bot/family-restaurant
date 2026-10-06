"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LOCALE_COOKIE } from "@/i18n/config";
import { canAccessPath, homeFor, safeNextPath } from "@/lib/auth/roles";
import { isValidUsername, usernameToEmail } from "@/lib/auth/username";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginError = "required" | "invalid" | "rate_limited" | "no_access" | "unknown";
export type LoginState = { error?: LoginError; username?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) return { error: "required", username };
  // Same answer as a wrong password: don't reveal which usernames exist.
  if (!isValidUsername(username) || password.length > 72) return { error: "invalid", username };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });

  if (error || !data.user) {
    if (error?.status === 429 || error?.code === "over_request_rate_limit") {
      return { error: "rate_limited", username };
    }
    if (error?.code === "invalid_credentials" || error?.status === 400) {
      return { error: "invalid", username };
    }
    return { error: "unknown", username };
  }

  const { data: profile } = await supabase.from("profiles").select("role, locale").eq("id", data.user.id).maybeSingle();

  if (!profile) {
    await supabase.auth.signOut({ scope: "local" });
    return { error: "no_access", username };
  }

  (await cookies()).set(LOCALE_COOKIE, profile.locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  const next = safeNextPath(formData.get("next"));
  redirect(next && canAccessPath(profile.role, next.split("?")[0]) ? next : homeFor(profile.role));
}

export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
