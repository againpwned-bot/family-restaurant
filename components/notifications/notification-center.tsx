"use client";

import { BellRing, CircleCheck, CircleX, Timer, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { markNotificationRead } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { useRealtime } from "@/hooks/use-realtime";
import { chimeFor, notificationHref, renderNotification } from "@/lib/notifications";
import { KITCHEN_TZ } from "@/lib/dates";
import { playChime } from "@/lib/sound";
import type { AppNotification, NotificationType } from "@/lib/types";
import { cn } from "@/lib/utils";

const AUTO_HIDE_MS = 10_000;
const MAX_VISIBLE = 3;

const ICONS: Record<NotificationType, typeof BellRing> = {
  order_new: BellRing,
  order_cancelled: CircleX,
  order_accepted: CircleCheck,
  order_rejected: CircleX,
  order_ready: CircleCheck,
  order_extended: Timer,
  test: BellRing,
};

/**
 * In-app notifications: whenever a row lands in `notifications` for the
 * signed-in user (new order, cancellation, accepted, ready, ...), show a banner
 * and play a short chime. Works whether or not Web Push is enabled.
 */
export function NotificationCenter({ userId }: { userId: string }) {
  const t = useTranslations("notifications");
  const format = useFormatter();
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string, markRead = true) => {
    setItems((list) => list.filter((n) => n.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    if (markRead) {
      void markNotificationRead(id).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((timer) => clearTimeout(timer));
  }, []);

  useRealtime("notifications", [{ table: "notifications", filter: `recipient_id=eq.${userId}` }], (_table, payload) => {
    if (payload.eventType !== "INSERT") return;
    const n = payload.new as unknown as AppNotification;
    // Ignore stale rows (e.g. delivered after a long reconnect).
    if (Date.now() - new Date(n.created_at).getTime() > 2 * 60_000) return;
    setItems((list) => [n, ...list.filter((x) => x.id !== n.id)].slice(0, MAX_VISIBLE));
    playChime(chimeFor(n.type));
    timers.current.set(
      n.id,
      setTimeout(() => dismiss(n.id, false), AUTO_HIDE_MS),
    );
    window.dispatchEvent(new CustomEvent("app:notification", { detail: n }));
  });

  const time = (iso: string) =>
    format.dateTime(new Date(iso), { hour: "2-digit", minute: "2-digit", timeZone: KITCHEN_TZ });

  return (
    <section
      aria-label={t("region")}
      aria-live="assertive"
      className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),0.75rem)] z-[70] flex flex-col items-center gap-2 px-3"
    >
      <AnimatePresence initial={false}>
        {items.map((n) => {
          const { title, body } = renderNotification(
            (key, values) => t(key as Parameters<typeof t>[0], values),
            n,
            time,
          );
          const Icon = ICONS[n.type];
          const tone =
            n.type === "order_cancelled" || n.type === "order_rejected"
              ? "bg-destructive/10 text-destructive"
              : n.type === "order_ready"
                ? "bg-success-soft text-success"
                : "bg-gold-soft text-gold-ink";
          return (
            <m.div
              key={n.id}
              initial={{ opacity: 0, y: -16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 200, damping: 24 }}
              role="status"
              className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-border bg-popover p-3 pr-2 text-popover-foreground shadow-xl shadow-black/10"
            >
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone)}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 py-0.5">
                <p className="font-bold leading-snug">{title}</p>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    dismiss(n.id);
                    router.push(notificationHref(n));
                  }}
                >
                  {t("view")}
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label={t("dismiss")} onClick={() => dismiss(n.id)}>
                  <X />
                </Button>
              </div>
            </m.div>
          );
        })}
      </AnimatePresence>
    </section>
  );
}
