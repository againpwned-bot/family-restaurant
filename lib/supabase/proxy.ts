import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isAppRole } from "@/lib/auth/roles";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";
import type { AppRole, Database } from "@/lib/supabase/database.types";

/**
 * Refreshes the Supabase session cookie (if needed) and returns who is
 * signed in. Must run before anything else reads the session.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers ?? {})) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // getClaims() verifies the JWT (locally with asymmetric signing keys, via the
  // Auth server otherwise). Never trust getSession() on the server.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;

  let role: AppRole | null = null;
  if (claims?.sub) {
    const fromToken = (claims.app_metadata as Record<string, unknown> | undefined)?.role;
    if (isAppRole(fromToken)) {
      role = fromToken;
    } else {
      // Account created without the role claim: fall back to the profile row.
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", claims.sub).maybeSingle();
      role = profile?.role ?? null;
    }
  }

  return {
    supabase,
    userId: claims?.sub ?? null,
    role,
    /** The response carrying any refreshed auth cookies. */
    response: () => response,
  };
}

/** Redirect that keeps the refreshed auth cookies from `from`. */
export function redirectKeepingCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(header);
    if (value) redirect.headers.set(header, value);
  }
  return redirect;
}
