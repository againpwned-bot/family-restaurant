import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("register_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: sub.keys.p256dh,
    p_auth: sub.keys.auth,
    p_user_agent: body?.userAgent?.slice(0, 300) ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: error.message === "forbidden" ? 401 : 400 });
  return NextResponse.json({ ok: true });
}
