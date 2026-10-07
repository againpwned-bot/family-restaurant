import type { AppNotification, NotificationType } from "@/lib/supabase/database.types";

// What the order triggers put in notifications.payload (see migrations).
export type NotificationPayload = {
  orderId?: string;
  number?: number;
  client?: string;
  dish?: string;
  quantity?: number;
  by?: string;
  minutes?: number;
  etaAt?: string;
  reason?: string | null;
  comment?: string | null;
  requestedFor?: string | null;
};

export const STAFF_TYPES: NotificationType[] = ["order_new", "order_cancelled"];

export function notificationHref(n: Pick<AppNotification, "type" | "order_id">): string {
  if (STAFF_TYPES.includes(n.type)) return "/admin";
  return n.order_id ? `/orders/${n.order_id}` : "/orders";
}

export function chimeFor(type: NotificationType): "order" | "ready" | "alert" {
  if (type === "order_ready") return "ready";
  if (type === "order_cancelled" || type === "order_rejected") return "alert";
  return "order";
}

/**
 * Title + body for a notification. `t` is a translator scoped to
 * "notifications"; `time` formats an ISO instant as HH:MM in the kitchen zone.
 * Messages only use plain {placeholders}, so the push Edge Function can render
 * the same strings without an ICU library.
 */
export function renderNotification(
  t: (key: string, values?: Record<string, string | number>) => string,
  n: Pick<AppNotification, "type" | "payload">,
  time: (iso: string) => string,
): { title: string; body: string } {
  const p = (n.payload ?? {}) as NotificationPayload;
  const values = {
    client: p.client ?? "",
    dish: p.dish ?? "",
    quantity: p.quantity ?? 1,
    minutes: p.minutes ?? 0,
    reason: p.reason ?? "",
    time: p.etaAt ? time(p.etaAt) : "",
  };
  const bodyKey = n.type === "order_rejected" && !p.reason ? `${n.type}.bodyNoReason` : `${n.type}.body`;
  return { title: t(`${n.type}.title`, values), body: t(bodyKey, values) };
}
