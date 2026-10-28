import type { AppNotification, AppRole, NotificationType } from "@/lib/types";

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
  title?: string;
  body?: string;
  broadcastId?: string;
  conversation?: string;
  fromId?: string;
  from?: string;
  preview?: string;
  group?: boolean;
};

export const STAFF_TYPES: NotificationType[] = ["order_new", "order_cancelled"];

export function chatHref(role: AppRole, conversation?: string | null): string {
  const base = role === "admin" ? "/admin/chat" : "/chat";
  return conversation ? `${base}?c=${encodeURIComponent(conversation)}` : base;
}

export function notificationHref(n: Pick<AppNotification, "type" | "order_id" | "payload">, role: AppRole): string {
  const p = (n.payload ?? {}) as NotificationPayload;
  if (n.type === "chat_message") return chatHref(role, p.conversation);
  if (n.type === "broadcast" || n.type === "test") return role === "admin" ? "/admin" : "/";
  if (STAFF_TYPES.includes(n.type)) return "/admin";
  return n.order_id ? `/orders/${n.order_id}` : "/orders";
}

export function notificationTag(n: Pick<AppNotification, "type" | "order_id" | "payload">): string {
  const p = (n.payload ?? {}) as NotificationPayload;
  if (n.type === "chat_message" && p.conversation) return `chat-${p.conversation}`;
  if (n.type === "broadcast" && p.broadcastId) return `broadcast-${p.broadcastId}`;
  return n.order_id ? `order-${n.order_id}` : n.type;
}

export function chimeFor(type: NotificationType): "order" | "ready" | "alert" {
  if (type === "order_ready") return "ready";
  if (type === "order_cancelled" || type === "order_rejected") return "alert";
  return "order";
}

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
    title: p.title ?? "",
    body: p.body ?? "",
    by: p.by ?? "",
    from: p.from ?? "",
    preview: p.preview ?? "",
  };
  const bodyKey = n.type === "order_rejected" && !p.reason ? `${n.type}.bodyNoReason` : `${n.type}.body`;
  const titleKey = n.type === "chat_message" && p.group ? `${n.type}.titleGroup` : `${n.type}.title`;
  return { title: t(titleKey, values), body: t(bodyKey, values) };
}
