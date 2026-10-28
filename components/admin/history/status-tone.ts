import type { OrderStatus } from "@/lib/types";

export const STATUS_TONE: Record<OrderStatus, string> = {
  received: "bg-gold-soft text-gold-ink",
  accepted: "bg-secondary text-secondary-foreground",
  cooking: "bg-primary/15 text-brand-ink",
  ready: "bg-success-soft text-success",
  handed_over: "bg-success-soft text-success",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};
