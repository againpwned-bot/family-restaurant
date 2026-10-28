"use client";

import {
  CircleCheck,
  Clock,
  Flame,
  LoaderCircle,
  MessageSquareQuote,
  PackageCheck,
  Printer,
  TriangleAlert,
  X,
} from "lucide-react";
import { m } from "motion/react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, type CSSProperties } from "react";
import { toast } from "sonner";

import dynamic from "next/dynamic";
import { DishPhoto } from "@/components/dish/dish-photo";
import { OrderTimerBar } from "@/components/orders/order-timer";
import { Button } from "@/components/ui/button";
import { KITCHEN_TZ } from "@/lib/dates";
import {
  acceptOrder,
  extendOrderTimer,
  handOverOrder,
  markOrderReady,
  rejectOrder,
  startCooking,
} from "@/app/actions/orders";
import { safe, type ActionResult } from "@/lib/action-result";
import { dbErrorKey } from "@/lib/errors";
import type { DietInfo, Order } from "@/lib/types";
import { useSkipEntrance } from "@/hooks/use-entrance";
import { cn } from "@/lib/utils";

const AcceptDialog = dynamic(() => import("@/components/admin/orders/order-dialogs").then((m) => m.AcceptDialog));
const RejectDialog = dynamic(() => import("@/components/admin/orders/order-dialogs").then((m) => m.RejectDialog));

export function OrderCard({
  order,
  clientName,
  diet,
  deciderName,
  photoBlur,
  defaultMinutes,
  highlight,
  onUpdated,
  onResync,
}: {
  order: Order;
  clientName: string;
  diet: DietInfo | null;
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

  async function run(action: string, call: Promise<ActionResult<Order>>, success: string) {
    setBusy(action);
    const { data, error } = await safe(call);
    setBusy(null);
    if (error) {
      const key = dbErrorKey(error);
      toast.error(t(`errors.db.${key}`));
      if (key === "invalid_transition" || key === "order_not_found") onResync();
      return false;
    }
    if (data) onUpdated(data);
    toast.success(success);
    return true;
  }

  const id = order.id;
  const n = order.number;
  const closed = order.status === "handed_over" || order.status === "rejected" || order.status === "cancelled";

  return (
    <m.article
      initial={skip ? false : { opacity: 0, y: -48, rotate: -9 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 11, mass: 0.9 }}
      style={{ transformOrigin: "50% 0" }}
      aria-labelledby={`order-${id}-title`}
      className={cn(
        "relative pt-2 [filter:drop-shadow(4px_4px_0_var(--shadow-hard))]",
        highlight && "animate-[wiggle_0.8s_ease-in-out_4]",
        closed && "opacity-75",
      )}
    >
      <span
        aria-hidden="true"
        className="absolute top-0 left-1/2 z-10 h-4 w-14 -translate-x-1/2 rounded-[4px] border-2 border-line bg-foreground"
      />
      <div
        className={cn(
          "relative grid grid-cols-[minmax(0,1fr)] gap-3 bg-paper px-4 pt-6 pb-5 ticket-edge",
          highlight && "bg-gold-soft",
        )}
      >
        <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b-2 border-dashed border-foreground/25 pb-2 font-mono">
          <h3 id={`order-${id}-title`} className="min-w-0 truncate text-base font-medium">
            <span className="mr-1.5 text-lg font-medium text-brand-ink">{t("adminOrders.number", { number: n })}</span>
            <span className="font-sans font-extrabold">{clientName}</span>
          </h3>
          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            {t("adminOrders.placedAt", { time: time(order.created_at) })}
            <a
              href={`/print/order/${order.id}`}
              target="_blank"
              rel="noopener"
              aria-label={t("adminOrders.printTicket", { number: n })}
              title={t("adminOrders.printTicket", { number: n })}
              className="-my-1 grid size-8 place-items-center rounded-full outline-none hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Printer className="size-4" aria-hidden="true" />
            </a>
          </span>
        </header>

        <div className="flex items-center gap-3">
          <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border-2 border-line bg-muted">
            <DishPhoto
              dish={{ name: order.dish_name, photo_path: order.dish_photo_path, photo_blur: photoBlur }}
              sizes="56px"
              quality={60}
            />
          </div>
          <div className="min-w-0">
            <p className="font-heading text-lg leading-tight font-black break-words hyphens-auto xl:text-xl">
              {order.dish_name}{" "}
              <span className="font-mono text-base font-medium whitespace-nowrap text-brand-ink">
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

        {diet && !closed ? <DietWarning diet={diet} /> : null}

        {order.comment ? (
          <blockquote className="flex -rotate-1 gap-2 rounded-lg border-2 border-line bg-gold-soft px-3 py-2 text-gold-ink">
            <MessageSquareQuote className="mt-1 size-4 shrink-0" aria-label={t("adminOrders.comment")} />
            <span className="font-hand text-xl leading-tight font-bold break-words">{order.comment}</span>
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
                onClick={() => run("cook", startCooking(id), t("adminOrders.toast.cooking", { number: n }))}
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
                      run(`ext${minutes}`, extendOrderTimer(id, minutes), t("adminOrders.toast.extended", { minutes }))
                    }
                  >
                    {busy === `ext${minutes}` ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
                    {t("adminOrders.actions.extend", { minutes })}
                  </Button>
                ))}
                <Button
                  className="w-full bg-success text-success-foreground"
                  size="lg"
                  disabled={!!busy}
                  onClick={() => run("ready", markOrderReady(id), t("adminOrders.toast.ready", { client: clientName }))}
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
                onClick={() => run("hand", handOverOrder(id), t("adminOrders.toast.handedOver", { number: n }))}
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
          <p
            className={cn(
              "pointer-events-none absolute top-12 right-3 animate-stamp rounded-md border-[3px] border-current px-2 py-0.5 font-sans text-lg font-black tracking-wider uppercase opacity-80",
              order.status === "handed_over" ? "text-success" : "text-destructive",
            )}
            style={{ "--stamp-rot": "-14deg" } as CSSProperties}
          >
            {t(`orderStatus.${order.status}`)}
          </p>
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
              if (await run("accept", acceptOrder(id, minutes), t("adminOrders.toast.accepted", { number: n })))
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
              if (await run("reject", rejectOrder(id, reason || null), t("adminOrders.toast.rejected", { number: n })))
                setDialog(null);
            }}
          />
        ) : null}
      </div>
    </m.article>
  );
}

export function DietWarning({ diet }: { diet: DietInfo }) {
  const t = useTranslations();
  return (
    <div
      role="note"
      className="flex gap-2 rounded-lg border-2 border-destructive bg-destructive/10 px-3 py-2 text-destructive"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 text-sm">
        <p className="font-extrabold uppercase tracking-wide">{t("diet.warning")}</p>
        {diet.allergies ? <p className="font-semibold break-words">{diet.allergies}</p> : null}
        {diet.tags.length ? (
          <p className="mt-0.5 flex flex-wrap gap-1">
            {diet.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-white">
                {t(`dietTags.${tag}`)}
              </span>
            ))}
          </p>
        ) : null}
      </div>
    </div>
  );
}
