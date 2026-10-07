"use client";

import { ArrowLeft, CircleCheck, MessageSquareQuote, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { CancelOrderButton, OrderCountdown, STATUS_TONE, useOrderTimes } from "@/components/client/client-order-card";
import { DishPhoto } from "@/components/dish/dish-photo";
import { PushPrompt } from "@/components/notifications/push-prompt";
import { StatusSteps } from "@/components/orders/status-steps";
import { TimerRing } from "@/components/orders/timer-ring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRealtime } from "@/hooks/use-realtime";
import { hasTimer, newer } from "@/lib/orders";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Order, OrderEvent } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

/** Full-screen status of one order: big timer, progress, timeline. */
export function OrderStatusView({
  initialOrder,
  initialEvents,
  people,
  dishAvailable,
}: {
  initialOrder: Order;
  initialEvents: OrderEvent[];
  people: Record<string, string>;
  dishAvailable: boolean;
}) {
  const t = useTranslations();
  const { time } = useOrderTimes();
  const [order, setOrder] = useState(initialOrder);
  const [events, setEvents] = useState(initialEvents);

  const resync = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const [o, e] = await Promise.all([
      supabase.from("orders").select("*").eq("id", initialOrder.id).maybeSingle(),
      supabase.from("order_events").select("*").eq("order_id", initialOrder.id).order("created_at"),
    ]);
    if (o.data) setOrder((prev) => newer(prev, o.data!));
    if (e.data) setEvents(e.data);
  }, [initialOrder.id]);

  useRealtime(
    `order-${initialOrder.id}`,
    [
      { table: "orders", filter: `id=eq.${initialOrder.id}` },
      { table: "order_events", filter: `order_id=eq.${initialOrder.id}` },
    ],
    (table, payload) => {
      if (payload.eventType === "DELETE") return;
      if (table === "orders") setOrder((prev) => newer(prev, payload.new as unknown as Order));
      else {
        const ev = payload.new as unknown as OrderEvent;
        setEvents((list) => (list.some((x) => x.id === ev.id) ? list : [...list, ev]));
      }
    },
    resync,
  );

  const eventText = (ev: OrderEvent) => {
    const name = ev.actor_id ? (people[ev.actor_id] ?? t("orders.someone")) : t("orders.someone");
    const data = (ev.data ?? {}) as { minutes?: number };
    return t(`orders.events.${ev.kind}`, { name, minutes: data.minutes ?? 0 });
  };

  return (
    <div className="grid gap-6">
      <Button asChild variant="ghost" className="-ml-3 justify-self-start">
        <Link href="/orders">
          <ArrowLeft aria-hidden="true" />
          {t("orders.back")}
        </Link>
      </Button>

      <PushPrompt />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <section
          aria-labelledby="status-title"
          className={cn(
            "grid justify-items-center gap-5 rounded-3xl border bg-card px-5 py-8 text-center shadow-sm",
            order.status === "ready" ? "border-success ring-4 ring-success/20" : "border-border",
          )}
        >
          <Badge className={cn("text-sm", STATUS_TONE[order.status])}>{t(`orderStatus.${order.status}`)}</Badge>
          {hasTimer(order) ? (
            <OrderCountdown order={order} size={208} large />
          ) : order.status === "ready" || order.status === "handed_over" ? (
            <TimerRing size={208} thickness={14} progress={1} tone="success">
              <CircleCheck className="size-20 text-success" aria-hidden="true" />
            </TimerRing>
          ) : (
            <TimerRing size={208} thickness={14} progress={0} tone="muted">
              <span className="relative size-24 overflow-hidden rounded-full">
                <DishPhoto
                  dish={{ name: order.dish_name, photo_path: order.dish_photo_path }}
                  sizes="96px"
                  quality={60}
                />
              </span>
            </TimerRing>
          )}
          <div className="grid gap-1" aria-live="polite">
            <h1 id="status-title" className="font-heading text-2xl font-bold sm:text-3xl">
              {t(`orders.status.${order.status}`)}
            </h1>
            {hasTimer(order) && order.eta_at ? (
              <p className="text-muted-foreground">{t("orders.eta", { time: time(order.eta_at) })}</p>
            ) : null}
            {order.status === "rejected" && order.reject_reason ? (
              <p className="text-muted-foreground">{t("orders.reason", { reason: order.reject_reason })}</p>
            ) : null}
          </div>
          <StatusSteps status={order.status} className="w-full max-w-md" />
          <div className="flex flex-wrap justify-center gap-2">
            <CancelOrderButton order={order} onCancelled={(o) => setOrder((prev) => newer(prev, o))} size="lg" />
            {(order.status === "handed_over" || order.status === "rejected" || order.status === "cancelled") &&
            order.dish_id &&
            dishAvailable ? (
              <Button asChild size="lg">
                <Link href={`/dish/${order.dish_id}`}>
                  <RotateCcw aria-hidden="true" />
                  {t("orders.orderAgain")}
                </Link>
              </Button>
            ) : null}
          </div>
          {order.status === "received" || order.status === "accepted" ? (
            <p className="text-sm text-muted-foreground">{t("orders.cancelHint")}</p>
          ) : null}
        </section>

        <div className="grid gap-4">
          <section className="flex items-center gap-4 rounded-3xl border border-border bg-card p-4">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-muted">
              <DishPhoto
                dish={{ name: order.dish_name, photo_path: order.dish_photo_path }}
                sizes="80px"
                quality={60}
              />
            </div>
            <div className="min-w-0">
              <p className="font-heading text-xl font-bold">
                {order.dish_name}{" "}
                <span className="font-sans text-base whitespace-nowrap text-brand-ink">× {order.quantity}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {t("orders.orderNumber", { number: order.number })} ·{" "}
                {order.requested_for ? t("orders.requestedFor", { time: time(order.requested_for) }) : t("orders.asap")}
              </p>
            </div>
          </section>

          {order.comment ? (
            <section className="rounded-3xl border border-border bg-card p-4">
              <h2 className="mb-1 flex items-center gap-2 font-sans text-sm font-bold">
                <MessageSquareQuote className="size-4" aria-hidden="true" />
                {t("orders.comment")}
              </h2>
              <p className="text-muted-foreground">{order.comment}</p>
            </section>
          ) : null}

          <section aria-labelledby="timeline-title" className="rounded-3xl border border-border bg-card p-4">
            <h2 id="timeline-title" className="mb-3 font-sans text-sm font-bold tracking-wide uppercase">
              {t("orders.timeline")}
            </h2>
            <ol className="relative grid gap-4 pl-6 before:absolute before:top-2 before:bottom-2 before:left-[0.4rem] before:w-0.5 before:bg-border">
              {events.map((ev) => (
                <li key={ev.id} className="relative">
                  <span
                    className="absolute top-1.5 -left-6 size-3.5 rounded-full border-2 border-card bg-primary"
                    aria-hidden="true"
                  />
                  <p className="font-semibold">{eventText(ev)}</p>
                  <p className="text-sm text-muted-foreground">{time(ev.created_at)}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
