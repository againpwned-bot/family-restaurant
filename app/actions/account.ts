"use server";

import { getCurrentProfile } from "@/lib/auth/dal";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, usernameToEmail } from "@/lib/auth/username";
import { createSupabaseStatelessClient } from "@/lib/supabase/server";

export type ChangePasswordError =
  "required" | "too_short" | "too_long" | "mismatch" | "same" | "wrong_current" | "rate_limited" | "unknown";

export type ChangePasswordState = { ok?: boolean; error?: ChangePasswordError; at?: number };

export async function changePassword(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "unknown" };

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("new") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!current || !next || !confirm) return { error: "required" };
  if (next.length < PASSWORD_MIN_LENGTH) return { error: "too_short" };
  if (new TextEncoder().encode(next).length > PASSWORD_MAX_LENGTH) return { error: "too_long" };
  if (next !== confirm) return { error: "mismatch" };
  if (next === current) return { error: "same" };

  // Verify the current password on a throwaway session, then change it from
  // that fresh session (satisfies "secure password change" if it is enabled),
  // and close it again. The user's real session is never touched.
  const verifier = createSupabaseStatelessClient();
  const { error: signInError } = await verifier.auth.signInWithPassword({
    email: usernameToEmail(profile.username),
    password: current,
  });
  if (signInError) {
    if (signInError.status === 429) return { error: "rate_limited" };
    return { error: "wrong_current" };
  }

  const { error: updateError } = await verifier.auth.updateUser({ password: next });
  await verifier.auth.signOut({ scope: "local" });
  if (updateError) {
    if (updateError.code === "weak_password") return { error: "too_short" };
    return { error: "unknown" };
  }

  return { ok: true, at: Date.now() };
}
