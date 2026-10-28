"use client";

import { useTranslations } from "next-intl";

import { useNow } from "@/hooks/use-now";
import { formatDuration } from "@/lib/dates";
import type { Order } from "@/lib/types";
import { cn } from "@/lib/utils";

export function timerState(order: Pick<Order, "eta_at" | "timer_minutes" | "decided_at">, now: number) {
  const eta = order.eta_at ? new Date(order.eta_at).getTime() : now;
  const remaining = eta - now;
  const totalMs = Math.max(1, (order.timer_minutes ?? 1) * 60_000);
  const progress = Math.min(1, Math.max(0, 1 - remaining / totalMs));
  return { remaining, overdue: remaining < 0, progress };
}

export function OrderTimerBar({
  order,
  className,
}: {
  order: Pick<Order, "eta_at" | "timer_minutes" | "decided_at">;
  className?: string;
}) {
  const t = useTranslations("adminOrders");
  const now = useNow();
  if (now === null || !order.eta_at) return <div className={cn("h-9", className)} aria-hidden="true" />;
  const { remaining, overdue, progress } = timerState(order, now);

  return (
    <div className={cn("grid gap-1.5", className)}>
      <p
        className={cn(
          "font-mono text-sm font-bold tabular-nums",
          overdue ? "text-destructive" : remaining < 5 * 60_000 ? "text-gold-ink" : "text-foreground",
        )}
        role="timer"
        aria-live="off"
      >
        {overdue
          ? t("overdue", { time: formatDuration(-remaining) })
          : t("remaining", { time: formatDuration(remaining) })}
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className={cn(
            "h-full origin-left rounded-full transition-transform duration-1000 ease-linear",
            overdue ? "bg-destructive" : "bg-gold",
          )}
          style={{ transform: `scaleX(${overdue ? 1 : progress})` }}
        />
      </div>
    </div>
  );
}
