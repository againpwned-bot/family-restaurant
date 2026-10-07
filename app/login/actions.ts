"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LOCALE_COOKIE } from "@/i18n/config";
import { getSession } from "@/lib/auth/dal";
import { canAccessPath, homeFor, safeNextPath } from "@/lib/auth/roles";
import { PASSWORD_MAX_LENGTH, isValidUsername } from "@/lib/auth/username";
import { row } from "@/lib/server/database";
import { getDb } from "@/lib/server/db";
import { verifyAgainstDummy, verifyPassword } from "@/lib/server/password";
import { clearFailures, isRateLimited, recordFailure } from "@/lib/server/rate-limit";
import { clientIp, isHttps, userAgent } from "@/lib/server/request";
import { SESSION_COOKIE, encodeSession, sessionCookieOptions } from "@/lib/server/session-cookie";
import type { AppRole, Locale } from "@/lib/types";

/** Wrong passwords for one username from any address, per 10 minutes. */
const ACCOUNT_MAX_FAILURES = 30;

export type LoginError = "required" | "invalid" | "rate_limited" | "no_access" | "unknown";
export type LoginState = { error?: LoginError; username?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) return { error: "required", username };
  // Same answer as a wrong password: don't reveal which usernames exist.
  if (!isValidUsername(username) || new TextEncoder().encode(password).length > PASSWORD_MAX_LENGTH) {
    return { error: "invalid", username };
  }

  const limitKey = `${username.toLowerCase()}|${await clientIp()}`;
  const accountKey = `account|${username.toLowerCase()}`;
  if (isRateLimited(limitKey) || isRateLimited(accountKey, ACCOUNT_MAX_FAILURES)) {
    return { error: "rate_limited", username };
  }

  let user: { id: string; role: AppRole; locale: Locale; password_hash: string } | null;
  let sessionId: string;
  try {
    const db = await getDb();
    user = await row(
      db,
      `select p.id, p.role, p.locale, u.password_hash
         from public.profiles p join auth.users u on u.id = p.id
        where lower(p.username) = lower($1)`,
      [username],
    );
    const ok = user ? await verifyPassword(password, user.password_hash) : await verifyAgainstDummy(password);
    if (!user || !ok) {
      recordFailure(limitKey);
      recordFailure(accountKey);
      return { error: "invalid", username };
    }
    clearFailures(limitKey);
    clearFailures(accountKey);
    const session = await row<{ id: string }>(
      db,
      "insert into auth.sessions (user_id, user_agent) values ($1, $2) returning id",
      [user.id, await userAgent()],
    );
    sessionId = session!.id;
    await db.query("update auth.users set last_sign_in_at = now() where id = $1", [user.id]);
  } catch (error) {
    console.error("[login]", error);
    return { error: "unknown", username };
  }

  const store = await cookies();
  store.set(
    SESSION_COOKIE,
    encodeSession({ sid: sessionId, uid: user.id, role: user.role }),
    sessionCookieOptions(await isHttps()),
  );
  store.set(LOCALE_COOKIE, user.locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });

  const next = safeNextPath(formData.get("next"));
  redirect(next && canAccessPath(user.role, next.split("?")[0]) ? next : homeFor(user.role));
}

export async function logout() {
  const session = await getSession();
  if (session) {
    await (await getDb()).query("delete from auth.sessions where id = $1", [session.sessionId]);
  }
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
