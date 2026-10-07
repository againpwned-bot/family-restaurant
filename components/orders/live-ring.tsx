"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { OrderCountdown } from "@/components/client/client-order-card";
import { timerState } from "@/components/orders/order-timer";
import { useAnimation } from "@/components/providers/animation-provider";
import { useNow } from "@/hooks/use-now";
import { formatDuration } from "@/lib/dates";
import type { Order } from "@/lib/types";

const loadRing = () => import("@/components/three/timer-ring-3d");
const TimerRing3D = dynamic(loadRing, { ssr: false });

/** Desktop-full: download + parse three.js during idle time on the order screen. */
export function usePrefetchRing3D() {
  const { tier, settled } = useAnimation();
  useEffect(() => {
    if (tier !== "full" || !settled) return;
    const schedule = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1000));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = schedule(() => void loadRing(), { timeout: 3000 });
    return () => cancel(id as number);
  }, [tier, settled]);
}

/**
 * The big ring on the order screen. Desktop-full: one 3D ring for the whole
 * life of the order (created once, then only its progress uniform changes);
 * elsewhere the CSS ring. `center` is what sits inside when there's no timer.
 */
export function LiveRing({
  order,
  label,
  fallback,
  inner,
}: {
  order: Order;
  label: string;
  /** Non-full tiers, no running timer: the CSS ring to show instead. */
  fallback: React.ReactNode;
  /** Desktop-full, no running timer: what sits inside the 3D ring. */
  inner: React.ReactNode;
}) {
  const { tier, settled } = useAnimation();
  const now = useNow();
  const [idle, setIdle] = useState(false);
  // Boot the 3D ring only when the page is idle (three.js init is one long task).
  useEffect(() => {
    if (tier !== "full" || !settled) return;
    const schedule = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 800));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = schedule(() => setIdle(true), { timeout: 3000 });
    return () => cancel(id as number);
  }, [tier, settled]);
  const timer = order.status === "accepted" || order.status === "cooking";
  if (tier !== "full" || !settled || !idle) {
    if (timer) return <OrderCountdown order={order} size={208} large />;
    return <>{fallback}</>;
  }
  const state = timer && now !== null ? timerState(order, now) : null;
  const done = order.status === "ready" || order.status === "handed_over";
  return (
    <div className="relative size-[13rem]">
      <TimerRing3D
        className="absolute -inset-10"
        progress={done ? 1 : (state?.progress ?? 0)}
        tone={done ? "success" : state?.overdue ? "destructive" : "gold"}
      />
      <span className="absolute inset-0 grid place-items-center">
        {timer ? (
          <span role="timer" aria-label={label} className="font-mono text-3xl font-bold tabular-nums">
            {state ? (state.overdue ? "0:00" : formatDuration(state.remaining)) : "--:--"}
          </span>
        ) : (
          <span className="grid size-[9.5rem] place-items-center overflow-hidden rounded-full">{inner}</span>
        )}
      </span>
    </div>
  );
}
