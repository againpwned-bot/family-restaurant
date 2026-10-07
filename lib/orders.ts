import type { Order, OrderStatus } from "@/lib/supabase/database.types";

export const OPEN_STATUSES = ["received", "accepted", "cooking", "ready"] as const satisfies readonly OrderStatus[];
export const CLOSED_STATUSES = ["handed_over", "rejected", "cancelled"] as const satisfies readonly OrderStatus[];

/** The client-facing progress steps (rejected / cancelled end the line early). */
export const PROGRESS_STEPS = ["received", "accepted", "cooking", "ready", "handed_over"] as const;

export function isOpen(status: OrderStatus): boolean {
  return (OPEN_STATUSES as readonly string[]).includes(status);
}

/** Clients may cancel until the pot is on the stove. */
export function canCancel(status: OrderStatus): boolean {
  return status === "received" || status === "accepted";
}

export function hasTimer(order: Pick<Order, "status" | "eta_at">): boolean {
  return (order.status === "accepted" || order.status === "cooking") && !!order.eta_at;
}

/** Keeps whichever version of an order is newer (realtime vs. action result). */
export function newer<T extends { updated_at: string }>(a: T | undefined, b: T): T {
  if (!a) return b;
  return new Date(b.updated_at) >= new Date(a.updated_at) ? b : a;
}

export const TIMER_PRESETS = [10, 15, 20, 30, 45, 60] as const;
