import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { homeFor } from "@/lib/auth/roles";
import { row } from "@/lib/server/database";
import { getDb } from "@/lib/server/db";
import { SESSION_COOKIE, decodeSession } from "@/lib/server/session-cookie";

// Clears a session cookie that no longer matches an open session (signed out
// elsewhere, password reset, role changed), then goes to the login page.
// Pages can't delete cookies while rendering, so lib/auth/dal.ts redirects
// here. A session that is still open is left alone: signing out is the
// menu's button (a POST), so a link from another site can't sign anyone out.
export async function GET(request: NextRequest) {
  const store = await cookies();
  const claims = decodeSession(store.get(SESSION_COOKIE)?.value);
  if (claims) {
    const open = await row(await getDb(), "select 1 from auth.sessions where id = $1 and user_id = $2", [
      claims.sid,
      claims.uid,
    ]).catch(() => null);
    if (open) return NextResponse.redirect(new URL(homeFor(claims.role), request.url));
  }
  store.delete(SESSION_COOKIE);
  return NextResponse.redirect(new URL("/login", request.url));
}
