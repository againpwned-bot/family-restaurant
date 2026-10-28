import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { canAccessPath, homeFor } from "@/lib/auth/roles";
import { row } from "@/lib/server/database";
import { getDb } from "@/lib/server/db";
import { SESSION_COOKIE, decodeSession } from "@/lib/server/session-cookie";
import type { AppRole, Profile } from "@/lib/types";

export type Session = { sessionId: string; profile: Profile };

export const getSession = cache(async (): Promise<Session | null> => {
  const claims = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const db = await getDb();
  const profile = await row<Profile>(
    db,
    `select p.* from auth.sessions s join public.profiles p on p.id = s.user_id
      where s.id = $1 and s.user_id = $2 and p.disabled_at is null`,
    [claims.sid, claims.uid],
  );
  if (!profile) return null;
  void db
    .query("update auth.sessions set last_seen_at = now() where id = $1 and last_seen_at < now() - interval '1 minute'", [
      claims.sid,
    ])
    .catch(() => {});
  return { sessionId: claims.sid, profile };
});

export const getCurrentProfile = cache(async (): Promise<Profile | null> => (await getSession())?.profile ?? null);

export async function requireProfile(options?: { roles?: AppRole[]; path?: string }): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    const hasCookie = (await cookies()).has(SESSION_COOKIE);
    redirect(hasCookie ? "/logout" : "/login");
  }
  if (options?.roles && !options.roles.includes(profile.role)) redirect(homeFor(profile.role));
  if (options?.path && !canAccessPath(profile.role, options.path)) redirect(homeFor(profile.role));
  return profile;
}
