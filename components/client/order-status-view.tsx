"use client";

import { ArrowLeft, CircleCheck, MessageSquareQuote, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { CancelOrderButton, STATUS_TONE, useOrderTimes, useReadyShot } from "@/components/client/client-order-card";
import { Confetti } from "@/components/decor/confetti";
import { CookingPot } from "@/components/decor/cooking-pot";
import { DishPhoto } from "@/components/dish/dish-photo";
import { StatusFlip } from "@/components/motion/status-flip";
import { PushPrompt } from "@/components/notifications/push-prompt";
import { LiveRing, usePrefetchRing3D } from "@/components/orders/live-ring";
import { StatusSteps } from "@/components/orders/status-steps";
import { TimerRing } from "@/components/orders/timer-ring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRealtime } from "@/hooks/use-realtime";
import { hasTimer, isOpen, newer } from "@/lib/orders";
import { fetchMyOrder } from "@/app/actions/orders";
import { safe } from "@/lib/action-result";
import type { Order, OrderEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

export function OrderStatusView({
  initialOrder,
  initialEvents,
  people,
  dishAvailable,
  showPushPrompt,
}: {
  initialOrder: Order;
  initialEvents: OrderEvent[];
  people: Record<string, string>;
  dishAvailable: boolean;
  showPushPrompt: boolean;
}) {
  const t = useTranslations();
  const { time } = useOrderTimes();
  const [order, setOrder] = useState(initialOrder);
  const [events, setEvents] = useState(initialEvents);
  usePrefetchRing3D();
  const shot = useReadyShot(order.status);

  const resync = useCallback(async () => {
    const { data } = await safe(fetchMyOrder(initialOrder.id));
    if (!data) return;
    if (data.order) setOrder((prev) => newer(prev, data.order!));
    setEvents(data.events);
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

      {showPushPrompt ? <PushPrompt /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <section
          aria-labelledby="status-title"
          className={cn(
            "relative grid justify-items-center gap-5 rounded-[2rem] bg-card px-5 py-8 text-center sticker",
            order.status === "ready" && "bg-success-soft",
          )}
        >
          <Confetti shot={shot} />
          <Badge className={cn("h-7 border-2 px-3 text-sm font-bold", STATUS_TONE[order.status])}>
            {t(`orderStatus.${order.status}`)}
          </Badge>
          {(() => {
            const photo = (
              <span className="relative size-24 overflow-hidden rounded-full">
                <DishPhoto
                  dish={{ name: order.dish_name, photo_path: order.dish_photo_path }}
                  sizes="96px"
                  quality={60}
                />
              </span>
            );
            const done = order.status === "ready" || order.status === "handed_over";
            const check = <CircleCheck className="size-20 text-success" aria-hidden="true" />;
            const cssRing = done ? (
              <TimerRing size={208} thickness={14} progress={1} tone="success">
                {check}
              </TimerRing>
            ) : (
              <TimerRing size={208} thickness={14} progress={0} tone="muted">
                {photo}
              </TimerRing>
            );
            return isOpen(order.status) ? (
              <LiveRing order={order} label={t("orders.timerLabel")} fallback={cssRing} inner={done ? check : photo} />
            ) : (
              cssRing
            );
          })()}
          {order.status === "cooking" ? <CookingPot className="-my-2 size-20 text-foreground" /> : null}
          <StatusFlip statusKey={order.status} className="grid gap-1">
            <div className="grid gap-1" aria-live="polite">
              <h1 id="status-title" className="font-heading text-3xl font-black sm:text-4xl">
                {t(`orders.status.${order.status}`)}
              </h1>
              {hasTimer(order) && order.eta_at ? (
                <p className="text-muted-foreground">{t("orders.eta", { time: time(order.eta_at) })}</p>
              ) : null}
              {order.status === "rejected" && order.reject_reason ? (
                <p className="text-muted-foreground">{t("orders.reason", { reason: order.reject_reason })}</p>
              ) : null}
            </div>
          </StatusFlip>
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
          <section className="flex items-center gap-4 rounded-[1.75rem] bg-card p-4 sticker">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl border-2 border-line bg-muted">
              <DishPhoto
                dish={{ name: order.dish_name, photo_path: order.dish_photo_path }}
                sizes="80px"
                quality={60}
              />
            </div>
            <div className="min-w-0">
              <p className="font-heading text-2xl font-black">
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
            <section className="-rotate-1 rounded-[1.75rem] border-2 border-line bg-gold-soft p-4 text-gold-ink">
              <h2 className="mb-1 flex items-center gap-2 font-sans text-sm font-bold">
                <MessageSquareQuote className="size-4" aria-hidden="true" />
                {t("orders.comment")}
              </h2>
              <p className="font-hand text-2xl leading-tight font-bold">{order.comment}</p>
            </section>
          ) : null}

          <section aria-labelledby="timeline-title" className="rounded-[1.75rem] bg-card p-4 sticker">
            <h2 id="timeline-title" className="mb-3 font-sans text-sm font-bold tracking-wide uppercase">
              {t("orders.timeline")}
            </h2>
            <ol className="relative grid gap-4 pl-7 before:absolute before:top-2 before:bottom-2 before:left-[0.45rem] before:border-l-2 before:border-dashed before:border-line/40">
              {events.map((ev, i) => (
                <li key={ev.id} className="relative">
                  <span
                    className={cn(
                      "absolute top-1 -left-7 size-4 rounded-full border-2 border-line",
                      i === events.length - 1 ? "bg-primary" : "bg-card",
                    )}
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
