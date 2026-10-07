// HS256 JWTs for the emulator (Supabase's legacy signing scheme).

import crypto from "node:crypto";

import type { Claims } from "./db";

export const JWT_SECRET = "local-emulator-jwt-secret-not-for-production";
export const PUBLISHABLE_KEY = "sb_publishable_local_emulator";
export const SECRET_KEY = "sb_secret_local_emulator";

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

export function signJwt(payload: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function verifyJwt(token: string): Record<string, unknown> | null {
  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature) return null;
  const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return null;
  }
  const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as Record<string, unknown>;
  if (typeof payload.exp === "number" && payload.exp < Date.now() / 1000) return null;
  return payload;
}

/** Who is calling: from the Authorization bearer (user JWT or secret key) or the apikey header. */
export function claimsFromHeaders(headers: Headers): Claims {
  const bearer = headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const apikey = headers.get("apikey") ?? "";
  if (bearer === SECRET_KEY || apikey === SECRET_KEY) return { role: "service_role" };
  if (bearer && bearer !== PUBLISHABLE_KEY) {
    const payload = verifyJwt(bearer);
    if (payload && (payload.role === "authenticated" || payload.role === "service_role")) {
      return payload as Claims;
    }
  }
  return { role: "anon" };
}
