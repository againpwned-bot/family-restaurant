"use server";

import { act } from "@/lib/server/action";
import { cleanHistoryFilters, orderEvents, searchOrders, type HistoryFilters } from "@/lib/server/queries";

const STAFF = ["owner", "admin"] as const;

export async function fetchOrderHistory(filters: Partial<HistoryFilters>, beforeNumber: number | null) {
  return act(STAFF, (tx) => searchOrders(tx, cleanHistoryFilters(filters), beforeNumber));
}

export async function fetchOrderTimeline(orderId: string) {
  return act(STAFF, (tx) => orderEvents(tx, orderId));
}
