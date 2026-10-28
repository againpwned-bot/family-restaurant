import { createHmac, timingSafeEqual } from "node:crypto";

import { isAppRole } from "../auth/roles";
import type { AppRole } from "../types";
import { secrets } from "./secrets";

export const SESSION_COOKIE = "meniu_session";
export const SESSION_DAYS = 30;
const RENEW_AFTER_DAYS = 1;

export type SessionClaims = { sid: string; uid: string; role: AppRole; exp: number; iat: number };

function sign(data: string): string {
  return createHmac("sha256", secrets().sessionKey).update(data).digest("base64url");
}

export function encodeSession(claims: Omit<SessionClaims, "exp" | "iat">, now = Date.now()): string {
  const full: SessionClaims = {
    ...claims,
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + SESSION_DAYS * 24 * 60 * 60,
  };
  const payload = Buffer.from(JSON.stringify(full)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(value: string | undefined | null, now = Date.now()): SessionClaims | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionClaims;
    if (typeof claims.sid !== "string" || typeof claims.uid !== "string" || !isAppRole(claims.role)) return null;
    if (typeof claims.exp !== "number" || claims.exp * 1000 <= now) return null;
    return claims;
  } catch {
    return null;
  }
}

export function shouldRenew(claims: SessionClaims, now = Date.now()): boolean {
  return now / 1000 - (claims.iat ?? 0) > RENEW_AFTER_DAYS * 24 * 60 * 60;
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}
