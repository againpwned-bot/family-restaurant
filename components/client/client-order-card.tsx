"use client";

import { ChevronRight, CircleCheck, LoaderCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Confetti } from "@/components/decor/confetti";
import { CookingPot } from "@/components/decor/cooking-pot";
import { DishPhoto } from "@/components/dish/dish-photo";
import { timerState } from "@/components/orders/order-timer";
import { StatusFlip } from "@/components/motion/status-flip";
import { StatusSteps } from "@/components/orders/status-steps";
import { TimerRing } from "@/components/orders/timer-ring";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-now";
import { KITCHEN_TZ, formatDuration, kitchenDate } from "@/lib/dates";
import { dbErrorKey } from "@/lib/errors";
import { canCancel, hasTimer } from "@/lib/orders";
import { cancelOrder } from "@/app/actions/orders";
import { safe } from "@/lib/action-result";
import type { Order, OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const STATUS_TONE: Record<OrderStatus, string> = {
  received: "border-line bg-gold text-gold-foreground",
  accepted: "border-line bg-card text-foreground",
  cooking: "border-line bg-primary text-primary-foreground",
  ready: "border-line bg-success text-success-foreground",
  handed_over: "border-border bg-muted text-muted-foreground",
  rejected: "border-destructive/40 bg-destructive/10 text-destructive",
  cancelled: "border-border bg-muted text-muted-foreground",
};

export function useReadyShot(status: OrderStatus): number | null {
  const previous = useRef<OrderStatus | null>(null);
  const [shot, setShot] = useState<number | null>(null);
  useEffect(() => {
    if (status === "ready" && previous.current !== "ready") setShot(Date.now());
    previous.current = status;
  }, [status]);
  return shot;
}

export function OrderCountdown({ order, size = 64, large = false }: { order: Order; size?: number; large?: boolean }) {
  const t = useTranslations("orders");
  const now = useNow();
  if (!hasTimer(order)) return null;
  const state = now === null ? null : timerState(order, now);
  return (
    <TimerRing
      size={size}
      thickness={large ? 14 : 7}
      progress={state?.progress ?? 0}
      tone={state?.overdue ? "destructive" : "gold"}
    >
      <span
        role="timer"
        aria-label={t("timerLabel")}
        className={cn("font-mono font-bold tabular-nums", large ? "text-3xl" : "text-xs")}
      >
        {state ? (state.overdue ? "0:00" : formatDuration(state.remaining)) : "--:--"}
      </span>
    </TimerRing>
  );
}

export function useOrderTimes() {
  const format = useFormatter();
  const t = useTranslations("common");
  const time = (iso: string) =>
    format.dateTime(new Date(iso), { hour: "2-digit", minute: "2-digit", timeZone: KITCHEN_TZ });
  const day = (iso: string) =>
    kitchenDate(new Date(iso)) === kitchenDate()
      ? t("today").toLocaleLowerCase()
      : format.dateTime(new Date(iso), { day: "numeric", month: "short", timeZone: KITCHEN_TZ });
  return { time, day };
}

export function CancelOrderButton({
  order,
  onCancelled,
  size = "default",
}: {
  order: Order;
  onCancelled: (o: Order) => void;
  size?: "default" | "lg";
}) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  if (!canCancel(order.status)) return null;
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size={size} disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <XCircle aria-hidden="true" />}
          {t("orders.cancel")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("orders.cancelTitle", { number: order.number })}</AlertDialogTitle>
          <AlertDialogDescription>{t("orders.cancelText")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("orders.keep")}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={async () => {
              setBusy(true);
              const { data, error } = await safe(cancelOrder(order.id));
              setBusy(false);
              if (error || !data) return void toast.error(t(`errors.db.${dbErrorKey(error)}`));
              onCancelled(data);
              toast.success(t("orders.cancelled"));
            }}
          >
            {t("orders.cancelConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ClientOrderCard({ order, onChange }: { order: Order; onChange: (o: Order) => void }) {
  const t = useTranslations();
  const { time, day } = useOrderTimes();
  const open = ["received", "accepted", "cooking", "ready"].includes(order.status);
  const shot = useReadyShot(order.status);

  return (
    <article
      aria-labelledby={`o-${order.id}`}
      className={cn(
        "relative grid gap-4 rounded-[1.75rem] bg-card p-4 sticker sm:p-5",
        order.status === "ready" && "bg-success-soft",
        !open && "opacity-85",
      )}
    >
      <Confetti shot={shot} />
      <div className="flex items-start gap-3">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl border-2 border-line bg-muted">
          <DishPhoto dish={{ name: order.dish_name, photo_path: order.dish_photo_path }} sizes="64px" quality={60} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 id={`o-${order.id}`} className="font-heading text-xl leading-tight font-black">
            {order.dish_name}{" "}
            <span className="font-sans text-base whitespace-nowrap text-brand-ink">× {order.quantity}</span>
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("orders.orderNumber", { number: order.number })} ·{" "}
            {t("orders.placedAt", { date: day(order.created_at), time: time(order.created_at) })}
          </p>
          <p className="text-sm text-muted-foreground">
            {order.requested_for ? t("orders.requestedFor", { time: time(order.requested_for) }) : t("orders.asap")}
          </p>
        </div>
        <Badge className={cn("h-6 shrink-0 border-2 px-2.5 font-bold", STATUS_TONE[order.status])}>
          {t(`orderStatus.${order.status}`)}
        </Badge>
      </div>

      {open ? <StatusSteps status={order.status} /> : null}

      <div className="flex items-center gap-4">
        {order.status === "cooking" ? <CookingPot className="size-14 shrink-0 text-foreground" /> : null}
        <OrderCountdown order={order} />
        <StatusFlip statusKey={order.status} className="min-w-0 flex-1">
          <p className={cn("font-semibold", order.status === "ready" && "text-lg text-success")}>
            {order.status === "ready" ? (
              <CircleCheck className="mr-1.5 inline size-5 align-[-4px]" aria-hidden="true" />
            ) : null}
            {t(`orders.status.${order.status}`)}
          </p>
          {hasTimer(order) && order.eta_at ? (
            <p className="text-sm text-muted-foreground">{t("orders.eta", { time: time(order.eta_at) })}</p>
          ) : null}
          {order.status === "rejected" && order.reject_reason ? (
            <p className="text-sm text-muted-foreground">{t("orders.reason", { reason: order.reject_reason })}</p>
          ) : null}
        </StatusFlip>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <CancelOrderButton order={order} onCancelled={onChange} />
        <Button asChild variant="ghost" className="ml-auto">
          <Link href={`/orders/${order.id}`}>
            {t("orders.viewOrder", { number: order.number })}
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </article>
  );
}
