"use server";

import { getSession } from "@/lib/auth/dal";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/username";
import { setPassword } from "@/lib/server/accounts";
import { row } from "@/lib/server/database";
import { getDb } from "@/lib/server/db";
import { verifyPassword } from "@/lib/server/password";
import { clearFailures, isRateLimited, recordFailure } from "@/lib/server/rate-limit";

export type ChangePasswordError =
  "required" | "too_short" | "too_long" | "mismatch" | "same" | "wrong_current" | "rate_limited" | "unknown";

export type ChangePasswordState = { ok?: boolean; error?: ChangePasswordError; at?: number };

export async function changePassword(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const session = await getSession();
  if (!session) return { error: "unknown" };

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("new") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!current || !next || !confirm) return { error: "required" };
  if (next.length < PASSWORD_MIN_LENGTH) return { error: "too_short" };
  if (new TextEncoder().encode(next).length > PASSWORD_MAX_LENGTH) return { error: "too_long" };
  if (next !== confirm) return { error: "mismatch" };
  if (next === current) return { error: "same" };

  const limitKey = `change-password|${session.profile.id}`;
  if (isRateLimited(limitKey)) return { error: "rate_limited" };

  try {
    const db = await getDb();
    const user = await row<{ password_hash: string }>(db, "select password_hash from auth.users where id = $1", [
      session.profile.id,
    ]);
    if (!user || !(await verifyPassword(current, user.password_hash))) {
      recordFailure(limitKey);
      return { error: "wrong_current" };
    }
    clearFailures(limitKey);
    await setPassword(db, session.profile.id, next, session.sessionId);
  } catch (error) {
    console.error("[change-password]", error);
    return { error: "unknown" };
  }
  return { ok: true, at: Date.now() };
}
