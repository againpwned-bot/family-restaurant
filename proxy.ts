import { NextResponse, type NextRequest } from "next/server";

import { canAccessPath, homeFor } from "@/lib/auth/roles";
import {
  SESSION_COOKIE,
  decodeSession,
  encodeSession,
  sessionCookieOptions,
  shouldRenew,
} from "@/lib/server/session-cookie";

// Route protection (formerly "middleware" - renamed to "proxy" in Next.js 16).
// This is the first gate and only checks the signed session cookie; layouts
// re-check the session and role in the database, and row level security is
// the last word on data.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // API routes answer 401 themselves; /logout clears a stale cookie.
  if (pathname.startsWith("/api/") || pathname === "/logout") return NextResponse.next();

  const claims = decodeSession(request.cookies.get(SESSION_COOKIE)?.value);
  const isLogin = pathname === "/login";

  if (!claims) {
    if (isLogin) return NextResponse.next();
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  let response: NextResponse;
  if (isLogin) {
    response = NextResponse.redirect(new URL(homeFor(claims.role), request.url));
  } else if (!canAccessPath(claims.role, pathname)) {
    const target = pathname.startsWith("/admin") && claims.role !== "client" ? "/admin" : homeFor(claims.role);
    response = NextResponse.redirect(new URL(target, request.url));
  } else {
    response = NextResponse.next();
  }

  if (shouldRenew(claims)) {
    response.cookies.set(
      SESSION_COOKIE,
      encodeSession({ sid: claims.sid, uid: claims.uid, role: claims.role }),
      sessionCookieOptions(request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https"),
    );
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except static assets, uploaded photos, the service worker, the manifest and icons.
    "/((?!_next/static|_next/image|uploads/|favicon\\.ico|sw\\.js|manifest\\.webmanifest|icons/|sounds/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|mp3|ogg|txt|xml)$).*)",
  ],
};
