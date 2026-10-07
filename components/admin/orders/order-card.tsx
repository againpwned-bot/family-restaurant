"use client";

import { CircleCheck, Clock, Flame, LoaderCircle, MessageSquareQuote, PackageCheck, X } from "lucide-react";
import { m } from "motion/react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import dynamic from "next/dynamic";
import { DishPhoto } from "@/components/dish/dish-photo";
import { OrderTimerBar } from "@/components/orders/order-timer";
import { Button } from "@/components/ui/button";
import { KITCHEN_TZ } from "@/lib/dates";
import { dbErrorKey } from "@/lib/errors";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database, Order } from "@/lib/supabase/database.types";
import { useSkipEntrance } from "@/hooks/use-entrance";
import { cn } from "@/lib/utils";

type Rpc = keyof Database["public"]["Functions"];

// Only opened on demand: keep the dialogs (and Radix Dialog) out of the board's first load.
const AcceptDialog = dynamic(() => import("@/components/admin/orders/order-dialogs").then((m) => m.AcceptDialog));
const RejectDialog = dynamic(() => import("@/components/admin/orders/order-dialogs").then((m) => m.RejectDialog));

export function OrderCard({
  order,
  clientName,
  deciderName,
  photoBlur,
  defaultMinutes,
  highlight,
  onUpdated,
  onResync,
}: {
  order: Order;
  clientName: string;
  deciderName: string | null;
  photoBlur: string | null;
  defaultMinutes: number;
  highlight?: boolean;
  onUpdated: (order: Order) => void;
  onResync: () => void;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const [busy, setBusy] = useState<string | null>(null);
  const skip = useSkipEntrance();
  const [dialog, setDialog] = useState<"accept" | "reject" | null>(null);
  const time = (iso: string) =>
    format.dateTime(new Date(iso), { hour: "2-digit", minute: "2-digit", timeZone: KITCHEN_TZ });

  async function run(action: string, fn: Rpc, args: Record<string, unknown>, success: string) {
    setBusy(action);
    const { data, error } = await getSupabaseBrowserClient().rpc(fn as "accept_order", args as never);
    setBusy(null);
    if (error) {
      const key = dbErrorKey(error);
      toast.error(t(`errors.db.${key}`));
      if (key === "invalid_transition" || key === "order_not_found") onResync();
      return false;
    }
    if (data) onUpdated(data as Order);
    toast.success(success);
    return true;
  }

  const id = order.id;
  const n = order.number;
  const closed = order.status === "handed_over" || order.status === "rejected" || order.status === "cancelled";

  return (
    <m.article
      initial={skip ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 180, damping: 24 }}
      aria-labelledby={`order-${id}-title`}
      className={cn(
        "grid gap-3 rounded-2xl border bg-card p-4 shadow-sm",
        highlight ? "border-gold ring-3 ring-gold/30" : "border-border",
        closed && "opacity-80",
      )}
    >
      <header className="flex items-center justify-between gap-3">
        <h3 id={`order-${id}-title`} className="min-w-0 truncate font-sans text-base font-bold">
          <span className="mr-1.5 text-muted-foreground">{t("adminOrders.number", { number: n })}</span>
          {clientName}
        </h3>
        <span className="shrink-0 text-xs text-muted-foreground">
          {t("adminOrders.placedAt", { time: time(order.created_at) })}
        </span>
      </header>

      <div className="flex items-center gap-3">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
          <DishPhoto
            dish={{ name: order.dish_name, photo_path: order.dish_photo_path, photo_blur: photoBlur }}
            sizes="56px"
            quality={60}
          />
        </div>
        <div className="min-w-0">
          <p className="font-heading text-lg leading-tight font-bold">
            {order.dish_name}{" "}
            <span className="font-sans text-base font-bold whitespace-nowrap text-brand-ink">
              {t("adminOrders.quantity", { quantity: order.quantity })}
            </span>
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-3.5" aria-hidden="true" />
            {order.requested_for
              ? t("adminOrders.requestedFor", { time: time(order.requested_for) })
              : t("adminOrders.asap")}
          </p>
        </div>
      </div>

      {order.comment ? (
        <blockquote className="flex gap-2 rounded-xl bg-gold-soft px-3 py-2 text-sm text-gold-ink">
          <MessageSquareQuote className="mt-0.5 size-4 shrink-0" aria-label={t("adminOrders.comment")} />
          <span className="break-words">{order.comment}</span>
        </blockquote>
      ) : null}

      {order.status === "accepted" || order.status === "cooking" ? <OrderTimerBar order={order} /> : null}
      {order.status === "ready" && order.ready_at ? (
        <p className="text-sm font-semibold text-success">
          {t("adminOrders.readySince", { time: time(order.ready_at) })}
        </p>
      ) : null}
      {order.status === "rejected" && order.reject_reason ? (
        <p className="text-sm text-muted-foreground">{t("adminOrders.reason", { reason: order.reject_reason })}</p>
      ) : null}

      {!closed ? (
        <div className="flex flex-wrap gap-2">
          {order.status === "received" ? (
            <>
              <Button className="flex-1" onClick={() => setDialog("accept")} disabled={!!busy}>
                <CircleCheck aria-hidden="true" />
                {t("adminOrders.actions.accept")}
              </Button>
              <Button variant="outline" onClick={() => setDialog("reject")} disabled={!!busy}>
                <X aria-hidden="true" />
                {t("adminOrders.actions.reject")}
              </Button>
            </>
          ) : null}

          {order.status === "accepted" ? (
            <Button
              variant="gold"
              className="flex-1"
              disabled={!!busy}
              onClick={() =>
                run("cook", "start_cooking", { p_order_id: id }, t("adminOrders.toast.cooking", { number: n }))
              }
            >
              {busy === "cook" ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Flame aria-hidden="true" />
              )}
              {t("adminOrders.actions.startCooking")}
            </Button>
          ) : null}

          {order.status === "accepted" || order.status === "cooking" ? (
            <>
              {[5, 10].map((minutes) => (
                <Button
                  key={minutes}
                  variant="outline"
                  size="sm"
                  className="h-10 pointer-coarse:h-11"
                  disabled={!!busy}
                  aria-label={t("adminOrders.actions.extendLabel", { minutes })}
                  onClick={() =>
                    run(
                      `ext${minutes}`,
                      "extend_order_timer",
                      { p_order_id: id, p_minutes: minutes },
                      t("adminOrders.toast.extended", { minutes }),
                    )
                  }
                >
                  {busy === `ext${minutes}` ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
                  {t("adminOrders.actions.extend", { minutes })}
                </Button>
              ))}
              <Button
                className="w-full bg-success text-success-foreground shadow-success/20"
                size="lg"
                disabled={!!busy}
                onClick={() =>
                  run(
                    "ready",
                    "mark_order_ready",
                    { p_order_id: id },
                    t("adminOrders.toast.ready", { client: clientName }),
                  )
                }
              >
                {busy === "ready" ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <CircleCheck aria-hidden="true" />
                )}
                {t("adminOrders.actions.ready")}
              </Button>
            </>
          ) : null}

          {order.status === "ready" ? (
            <Button
              variant="outline"
              className="w-full"
              disabled={!!busy}
              onClick={() =>
                run("hand", "hand_over_order", { p_order_id: id }, t("adminOrders.toast.handedOver", { number: n }))
              }
            >
              {busy === "hand" ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <PackageCheck aria-hidden="true" />
              )}
              {t("adminOrders.actions.handOver")}
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm font-semibold text-muted-foreground">{t(`orderStatus.${order.status}`)}</p>
      )}

      {deciderName && order.status !== "received" && order.status !== "cancelled" ? (
        <p className="text-xs text-muted-foreground">
          {order.status === "rejected"
            ? t("adminOrders.rejectedBy", { name: deciderName })
            : t("adminOrders.acceptedBy", { name: deciderName })}
        </p>
      ) : null}
      {order.status === "cancelled" ? (
        <p className="text-xs text-muted-foreground">{t("adminOrders.cancelledByClient")}</p>
      ) : null}

      {dialog === "accept" ? (
        <AcceptDialog
          order={order}
          clientName={clientName}
          open
          onOpenChange={(open) => !open && setDialog(null)}
          busy={busy === "accept"}
          defaultMinutes={defaultMinutes}
          onConfirm={async (minutes) => {
            if (
              await run(
                "accept",
                "accept_order",
                { p_order_id: id, p_minutes: minutes },
                t("adminOrders.toast.accepted", { number: n }),
              )
            )
              setDialog(null);
          }}
        />
      ) : null}
      {dialog === "reject" ? (
        <RejectDialog
          order={order}
          clientName={clientName}
          open
          onOpenChange={(open) => !open && setDialog(null)}
          busy={busy === "reject"}
          onConfirm={async (reason) => {
            if (
              await run(
                "reject",
                "reject_order",
                { p_order_id: id, p_reason: reason || null },
                t("adminOrders.toast.rejected", { number: n }),
              )
            )
              setDialog(null);
          }}
        />
      ) : null}
    </m.article>
  );
}
