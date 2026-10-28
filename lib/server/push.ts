import webpush from "web-push";

import en from "../../messages/en.json";
import ro from "../../messages/ro.json";
import { notificationHref, notificationTag } from "../notifications";
import type { AppNotification, AppRole, Locale } from "../types";
import { row, rows, type Db } from "./database";
import { secrets } from "./secrets";

type Strings = Record<string, { title: string; body: string; bodyNoReason?: string; titleGroup?: string }>;

function strings(namespace: Record<string, unknown>): Strings {
  return Object.fromEntries(Object.entries(namespace).filter(([, v]) => typeof v === "object")) as Strings;
}
const MESSAGES: Record<Locale, Strings> = { ro: strings(ro.notifications), en: strings(en.notifications) };

const URGENT_TYPES = new Set(["order_new", "order_ready", "order_cancelled", "broadcast"]);

export function renderPush(locale: Locale, n: Pick<AppNotification, "type" | "payload">) {
  const p = (n.payload ?? {}) as Record<string, unknown>;
  const entry = (MESSAGES[locale] ?? MESSAGES.ro)[n.type];
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
    title: String(p.title ?? ""),
    body: String(p.body ?? ""),
    from: String(p.from ?? ""),
    preview: String(p.preview ?? ""),
    by: String(p.by ?? ""),
    time,
  };
  const fill = (template: string) => template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
  const body = n.type === "order_rejected" && !p.reason && entry.bodyNoReason ? entry.bodyNoReason : entry.body;
  const title = n.type === "chat_message" && p.group && entry.titleGroup ? entry.titleGroup : entry.title;
  return { title: fill(title), body: fill(body) };
}

export function vapidPublicKey(): string {
  return secrets().vapidPublicKey;
}

async function deliver(db: Db, notificationId: string) {
  const n = await row<AppNotification & { locale: Locale; role: AppRole }>(
    db,
    `select n.*, p.locale, p.role from public.notifications n join public.profiles p on p.id = n.recipient_id
      where n.id = $1 and p.disabled_at is null`,
    [notificationId],
  );
  if (!n) return;
  const text = renderPush(n.locale === "en" ? "en" : "ro", n);
  if (!text) return;

  const subscriptions = await rows<{ id: string; endpoint: string; p256dh: string; auth: string }>(
    db,
    "select id, endpoint, p256dh, auth from public.push_subscriptions where user_id = $1",
    [n.recipient_id],
  );
  if (!subscriptions.length) return;

  const payload = JSON.stringify({
    ...text,
    type: n.type,
    url: notificationHref(n, n.role),
    tag: notificationTag(n),
    lang: n.locale,
    timestamp: new Date(n.created_at).getTime(),
  });

  let sent = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
        TTL: 60 * 60,
        urgency: URGENT_TYPES.has(n.type) ? "high" : "normal",
        topic: n.order_id ? n.order_id.replace(/-/g, "").slice(0, 32) : undefined,
        timeout: 10_000,
      });
      sent++;
      await db.query(
        "update public.push_subscriptions set last_success_at = now(), failure_count = 0 where id = $1",
        [sub.id],
      );
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db.query("delete from public.push_subscriptions where id = $1", [sub.id]);
      } else {
        await db.query("update public.push_subscriptions set failure_count = failure_count + 1 where id = $1", [sub.id]);
        console.warn(`[push] ${new URL(sub.endpoint).host}: ${status ?? (error as Error).message}`);
      }
    }
  }
  if (sent) await db.query("update public.notifications set pushed_at = now() where id = $1", [n.id]);
}

export async function startPushWorker(db: Db) {
  const keys = secrets();
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:meniu-de-acasa@example.com",
    keys.vapidPublicKey,
    keys.vapidPrivateKey,
  );
  let queue = Promise.resolve();
  await db.listen("push", (id) => {
    queue = queue.then(() => deliver(db, id)).catch((error) => console.error("[push]", error));
  });
}
