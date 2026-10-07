// send-push: called by the notifications_send_push trigger (pg_net) for every
// new notification row. Renders the text in the recipient's language and sends
// it to each of their browsers with Web Push (VAPID).
//
// Runtime-neutral on purpose: index.ts runs it on Supabase Edge (Deno), and the
// local emulator runs it in Node with the same inputs.

type Locale = "ro" | "en";
type Strings = Record<string, { title: string; body: string; bodyNoReason?: string }>;

export type PushSubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string };
type NotificationRow = {
  id: string;
  recipient_id: string;
  order_id: string | null;
  type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

// Minimal shapes of the clients we need (supabase-js and web-push).
type Query = PromiseLike<{ data: unknown; error: { message: string } | null }>;
export type PushDeps = {
  secret: string;
  messages: Record<Locale, Strings>;
  supabase: {
    from: (table: string) => {
      select: (columns: string) => { eq: (column: string, value: string) => Query & { maybeSingle: () => Query } };
      update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => Query };
      delete: () => { eq: (column: string, value: string) => Query };
    };
  };
  webpush: {
    sendNotification: (
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
      payload: string,
      options: { TTL: number; urgency: "high" | "normal"; topic?: string },
    ) => Promise<{ statusCode: number }>;
  };
  log?: (message: string) => void;
};

const STAFF_TYPES = new Set(["order_new", "order_cancelled"]);
const URGENT_TYPES = new Set(["order_new", "order_ready", "order_cancelled"]);

function hrefFor(n: NotificationRow) {
  if (STAFF_TYPES.has(n.type)) return "/admin";
  if (n.type === "test") return "/";
  return n.order_id ? `/orders/${n.order_id}` : "/orders";
}

/** Same texts as the in-app banner (messages/*.json -> notifications). */
export function renderPush(
  messages: Record<Locale, Strings>,
  locale: Locale,
  n: Pick<NotificationRow, "type" | "payload">,
) {
  const p = (n.payload ?? {}) as Record<string, unknown>;
  const strings = messages[locale] ?? messages.ro;
  const entry = strings[n.type];
  if (!entry) return null;
  const time =
    typeof p.etaAt === "string"
      ? new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Bucharest",
        }).format(new Date(p.etaAt))
      : "";
  const values: Record<string, string> = {
    client: String(p.client ?? ""),
    dish: String(p.dish ?? ""),
    quantity: String(p.quantity ?? 1),
    minutes: String(p.minutes ?? ""),
    reason: String(p.reason ?? ""),
    time,
  };
  const fill = (template: string) => template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
  const body = n.type === "order_rejected" && !p.reason && entry.bodyNoReason ? entry.bodyNoReason : entry.body;
  return { title: fill(entry.title), body: fill(body) };
}

export function createPushHandler(deps: PushDeps) {
  const log = deps.log ?? (() => {});

  return async function handle(request: Request): Promise<Response> {
    if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
    const auth = request.headers.get("authorization") ?? "";
    if (!deps.secret || auth !== `Bearer ${deps.secret}`) return new Response("unauthorized", { status: 401 });

    let notification: NotificationRow;
    try {
      notification = ((await request.json()) as { record: NotificationRow }).record;
    } catch {
      return new Response("bad request", { status: 400 });
    }
    if (!notification?.id || !notification.recipient_id) return new Response("bad request", { status: 400 });

    const { data: profile } = await deps.supabase
      .from("profiles")
      .select("locale")
      .eq("id", notification.recipient_id)
      .maybeSingle();
    const locale: Locale = (profile as { locale?: Locale } | null)?.locale === "en" ? "en" : "ro";
    const text = renderPush(deps.messages, locale, notification);
    if (!text) return Response.json({ sent: 0, skipped: "unknown type" });

    const { data: subs, error } = await deps.supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", notification.recipient_id);
    if (error) return new Response(error.message, { status: 500 });

    const payload = JSON.stringify({
      ...text,
      type: notification.type,
      url: hrefFor(notification),
      tag: notification.order_id ? `order-${notification.order_id}` : notification.type,
      lang: locale,
      timestamp: new Date(notification.created_at).getTime(),
    });

    let sent = 0;
    let removed = 0;
    for (const sub of (subs ?? []) as PushSubscriptionRow[]) {
      try {
        await deps.webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          {
            TTL: 60 * 60,
            urgency: URGENT_TYPES.has(notification.type) ? "high" : "normal",
            topic: notification.order_id ? notification.order_id.replace(/-/g, "").slice(0, 32) : undefined,
          },
        );
        sent++;
        await deps.supabase
          .from("push_subscriptions")
          .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
          .eq("id", sub.id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // The browser unsubscribed or the subscription expired.
          await deps.supabase.from("push_subscriptions").delete().eq("id", sub.id);
          removed++;
        } else {
          log(`push to ${new URL(sub.endpoint).host} failed: ${status ?? String(e)}`);
        }
      }
    }

    if (sent)
      await deps.supabase
        .from("notifications")
        .update({ pushed_at: new Date().toISOString() })
        .eq("id", notification.id);
    return Response.json({ sent, removed });
  };
}
