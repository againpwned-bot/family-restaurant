import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/lib/auth/dal";
import { asUser } from "@/lib/server/db";
import { dbErrorKey } from "@/lib/errors";

// Used by the service worker when the browser rotates a push subscription
// (pushsubscriptionchange). The session cookie identifies the user; the
// database function moves/creates the subscription for them.
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    userAgent?: string;
  } | null;
  const sub = body?.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys.auth) {
    return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 401 });
  try {
    await asUser(session.profile.id, (tx) =>
      tx.query("select public.register_push_subscription($1, $2, $3, $4)", [
        sub.endpoint,
        sub.keys!.p256dh,
        sub.keys!.auth,
        body?.userAgent?.slice(0, 300) ?? null,
      ]),
    );
  } catch (error) {
    const message = (error as Error).message;
    return NextResponse.json({ error: message === "invalid_subscription" ? message : dbErrorKey(error as Error) }, {
      status: 400,
    });
  }
  return NextResponse.json({ ok: true });
}
