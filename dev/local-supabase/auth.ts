// Supabase Auth (GoTrue) subset: password sign-in, refresh, current user,
// password change, sign-out, and the admin user API used by the seed script and
// the owner's Users page. Sign-up is disabled, like the real project.

import crypto from "node:crypto";

import type { PGlite } from "@electric-sql/pglite";

import { claimsFromHeaders, signJwt, verifyJwt } from "./jwt";
import { empty, json, readJson } from "./http";

type UserRow = {
  id: string;
  email: string;
  encrypted_password: string | null;
  raw_app_meta_data: Record<string, unknown>;
  raw_user_meta_data: Record<string, unknown>;
  last_sign_in_at: string | null;
  created_at: string;
  updated_at: string;
};

const ACCESS_TTL = 3600;
const attempts = new Map<string, number[]>();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 32);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

function checkPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [, salt, hash] = stored.split("$");
  const candidate = crypto.scryptSync(password, Buffer.from(salt, "base64"), 32);
  return crypto.timingSafeEqual(candidate, Buffer.from(hash, "base64"));
}

function authError(status: number, errorCode: string, msg: string): Response {
  return json(status, { code: status, error_code: errorCode, msg });
}

function toUser(row: UserRow) {
  return {
    id: row.id,
    aud: "authenticated",
    role: "authenticated",
    email: row.email,
    email_confirmed_at: row.created_at,
    confirmed_at: row.created_at,
    phone: "",
    last_sign_in_at: row.last_sign_in_at,
    app_metadata: { provider: "email", providers: ["email"], ...row.raw_app_meta_data },
    user_metadata: row.raw_user_meta_data,
    identities: [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_anonymous: false,
  };
}

export function createAuth(db: PGlite, issuer: string) {
  async function findUser(where: "id" | "email", value: string) {
    const res = await db.query<UserRow>(`select * from auth.users where ${where} = $1`, [value]);
    return res.rows[0] ?? null;
  }

  async function issueSession(user: UserRow, sessionId: string = crypto.randomUUID()) {
    const now = Math.floor(Date.now() / 1000);
    const refreshToken = crypto.randomBytes(24).toString("base64url");
    await db.query("insert into _local.refresh_tokens (token, user_id, session_id) values ($1, $2, $3)", [
      refreshToken,
      user.id,
      sessionId,
    ]);
    const u = toUser(user);
    const accessToken = signJwt({
      aud: "authenticated",
      iss: issuer,
      sub: user.id,
      email: user.email,
      phone: "",
      role: "authenticated",
      aal: "aal1",
      amr: [{ method: "password", timestamp: now }],
      app_metadata: u.app_metadata,
      user_metadata: u.user_metadata,
      session_id: sessionId,
      is_anonymous: false,
      iat: now,
      exp: now + ACCESS_TTL,
    });
    return {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: ACCESS_TTL,
      expires_at: now + ACCESS_TTL,
      refresh_token: refreshToken,
      user: u,
    };
  }

  function rateLimited(ip: string): boolean {
    const now = Date.now();
    const recent = (attempts.get(ip) ?? []).filter((t) => now - t < 5 * 60_000);
    recent.push(now);
    attempts.set(ip, recent);
    // Supabase's default is 30 sign-ins / 5 min / IP; the emulator allows more
    // because the end-to-end tests sign in many times from 127.0.0.1.
    return recent.length > Number(process.env.LOCAL_AUTH_RATE_LIMIT ?? 500);
  }

  return async function handle(request: Request, pathname: string, ip: string): Promise<Response> {
    const url = new URL(request.url);
    const route = pathname.replace(/^\/auth\/v1/, "");

    if (route === "/health" || route === "/settings") {
      return json(200, { external: { email: true }, disable_signup: true });
    }

    if (route === "/signup") return authError(422, "signup_disabled", "Signups not allowed for this instance");

    if (route === "/token" && request.method === "POST") {
      const grant = url.searchParams.get("grant_type");
      const body = await readJson<{ email?: string; password?: string; refresh_token?: string }>(request);

      if (grant === "password") {
        if (rateLimited(ip)) return authError(429, "over_request_rate_limit", "Request rate limit reached");
        const user = body.email ? await findUser("email", body.email.toLowerCase()) : null;
        if (!user || !checkPassword(body.password ?? "", user.encrypted_password)) {
          return authError(400, "invalid_credentials", "Invalid login credentials");
        }
        await db.query("update auth.users set last_sign_in_at = now() where id = $1", [user.id]);
        return json(200, await issueSession(user));
      }

      if (grant === "refresh_token") {
        const res = await db.query<{ user_id: string; session_id: string; revoked: boolean }>(
          "select user_id, session_id, revoked from _local.refresh_tokens where token = $1",
          [body.refresh_token ?? ""],
        );
        const token = res.rows[0];
        if (!token || token.revoked) return authError(400, "refresh_token_not_found", "Invalid Refresh Token");
        const user = await findUser("id", token.user_id);
        if (!user) return authError(400, "user_not_found", "User not found");
        await db.query("update _local.refresh_tokens set revoked = true where token = $1", [body.refresh_token]);
        return json(200, await issueSession(user, token.session_id));
      }
      return authError(400, "unsupported_grant_type", "Unsupported grant type");
    }

    // Everything below needs a valid access token (or the secret key for /admin).
    const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const claims = verifyJwt(bearer);

    if (route === "/user") {
      if (!claims?.sub) return authError(401, "bad_jwt", "invalid JWT: unable to parse or verify signature");
      const user = await findUser("id", String(claims.sub));
      if (!user) return authError(403, "user_not_found", "User from sub claim in JWT does not exist");
      if (request.method === "PUT") {
        const body = await readJson<{ password?: string; data?: Record<string, unknown> }>(request);
        if (body.password !== undefined) {
          if (body.password.length < 8)
            return authError(422, "weak_password", "Password should be at least 8 characters");
          await db.query("update auth.users set encrypted_password = $1, updated_at = now() where id = $2", [
            hashPassword(body.password),
            user.id,
          ]);
        }
        return json(200, toUser((await findUser("id", user.id))!));
      }
      return json(200, toUser(user));
    }

    if (route === "/logout" && request.method === "POST") {
      if (claims?.session_id) {
        const scope = url.searchParams.get("scope") ?? "global";
        if (scope === "global") {
          await db.query("update _local.refresh_tokens set revoked = true where user_id = $1", [claims.sub]);
        } else {
          await db.query("update _local.refresh_tokens set revoked = true where session_id = $1", [claims.session_id]);
        }
      }
      return empty(204);
    }

    if (route.startsWith("/admin/users")) {
      if (claimsFromHeaders(request.headers).role !== "service_role") {
        return authError(403, "not_admin", "User not allowed");
      }
      const id = route.split("/")[3];

      if (!id && request.method === "GET") {
        const page = Number(url.searchParams.get("page") ?? 1);
        const perPage = Number(url.searchParams.get("per_page") ?? 50);
        const res = await db.query<UserRow>("select * from auth.users order by created_at limit $1 offset $2", [
          perPage,
          (page - 1) * perPage,
        ]);
        const total = (await db.query<{ n: number }>("select count(*)::int as n from auth.users")).rows[0].n;
        return json(200, { users: res.rows.map(toUser), aud: "authenticated" }, { "x-total-count": String(total) });
      }

      if (!id && request.method === "POST") {
        const body = await readJson<{
          email?: string;
          password?: string;
          app_metadata?: Record<string, unknown>;
          user_metadata?: Record<string, unknown>;
        }>(request);
        if (!body.email) return authError(400, "validation_failed", "email is required");
        if (await findUser("email", body.email.toLowerCase())) {
          return authError(422, "email_exists", "A user with this email address has already been registered");
        }
        const res = await db.query<UserRow>(
          `insert into auth.users (id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
           values ($1, $2, $3, $4, $5) returning *`,
          [
            crypto.randomUUID(),
            body.email.toLowerCase(),
            body.password ? hashPassword(body.password) : null,
            JSON.stringify(body.app_metadata ?? {}),
            JSON.stringify(body.user_metadata ?? {}),
          ],
        );
        return json(200, toUser(res.rows[0]));
      }

      if (id && request.method === "GET") {
        const user = await findUser("id", id);
        return user ? json(200, toUser(user)) : authError(404, "user_not_found", "User not found");
      }

      if (id && request.method === "PUT") {
        const user = await findUser("id", id);
        if (!user) return authError(404, "user_not_found", "User not found");
        const body = await readJson<{
          password?: string;
          app_metadata?: Record<string, unknown>;
          user_metadata?: Record<string, unknown>;
        }>(request);
        await db.query(
          `update auth.users set
             encrypted_password = coalesce($2, encrypted_password),
             raw_app_meta_data = coalesce($3::jsonb, raw_app_meta_data),
             raw_user_meta_data = coalesce($4::jsonb, raw_user_meta_data),
             updated_at = now()
           where id = $1`,
          [
            id,
            body.password ? hashPassword(body.password) : null,
            body.app_metadata ? JSON.stringify({ ...user.raw_app_meta_data, ...body.app_metadata }) : null,
            body.user_metadata ? JSON.stringify(body.user_metadata) : null,
          ],
        );
        return json(200, toUser((await findUser("id", id))!));
      }

      if (id && request.method === "DELETE") {
        await db.query("delete from auth.users where id = $1", [id]);
        return json(200, {});
      }
    }

    return authError(404, "not_found", `Emulator: ${request.method} ${route} is not implemented`);
  };
}
