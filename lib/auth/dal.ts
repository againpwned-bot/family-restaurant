import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { canAccessPath, homeFor } from "@/lib/auth/roles";
import type { AppRole, Profile } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Data access layer: the signed-in user's profile, read once per request.
 * The role comes from the database (source of truth), not from the token.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return profile ?? null;
});

/** Profile of the signed-in user, or a redirect if missing / not allowed here. */
export async function requireProfile(options?: { roles?: AppRole[]; path?: string }): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (options?.roles && !options.roles.includes(profile.role)) redirect(homeFor(profile.role));
  if (options?.path && !canAccessPath(profile.role, options.path)) redirect(homeFor(profile.role));
  return profile;
}
