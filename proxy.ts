import type { NextRequest } from "next/server";

import { canAccessPath, homeFor } from "@/lib/auth/roles";
import { redirectKeepingCookies, updateSession } from "@/lib/supabase/proxy";

// Route protection (formerly "middleware" - renamed to "proxy" in Next.js 16).
// This is the first gate; layouts re-check the role from the database and RLS
// is the last word on data.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await updateSession(request);
  const isLogin = pathname === "/login";

  if (!session.userId) {
    if (isLogin) return session.response();
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return redirectKeepingCookies(url, session.response());
  }

  if (!session.role) {
    // Signed in, but no profile: not a family account. Drop the session.
    await session.supabase.auth.signOut({ scope: "local" });
    if (isLogin) return session.response();
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "no_access");
    return redirectKeepingCookies(url, session.response());
  }

  if (isLogin) {
    return redirectKeepingCookies(new URL(homeFor(session.role), request.url), session.response());
  }

  if (!canAccessPath(session.role, pathname)) {
    const target = pathname.startsWith("/admin") && session.role !== "client" ? "/admin" : homeFor(session.role);
    return redirectKeepingCookies(new URL(target, request.url), session.response());
  }

  return session.response();
}

export const config = {
  matcher: [
    // Everything except static assets, the service worker, the manifest and icons.
    "/((?!_next/static|_next/image|favicon\\.ico|sw\\.js|manifest\\.webmanifest|icons/|sounds/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|mp3|ogg|txt|xml)$).*)",
  ],
};
