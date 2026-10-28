"use server";

import { act } from "@/lib/server/action";
import { row, type Tx } from "@/lib/server/database";
import {
  activeOrders,
  boardOrders,
  orderEvents,
  orderHistory,
  ownOrder,
  peopleDiets,
  peopleNames,
} from "@/lib/server/queries";
import { kitchenDayStart } from "@/lib/dates";
import type { Order } from "@/lib/types";

const STAFF = ["owner", "admin"] as const;
const CLIENTS = ["owner", "client"] as const;

const call = (fn: string, args: unknown[]) => async (tx: Tx) =>
  (await row<Order>(tx, `select * from public.${fn}(${args.map((_, i) => `$${i + 1}`).join(", ")})`, args))!;

export async function placeOrder(input: {
  dishId: string;
  quantity: number;
  comment: string | null;
  requestedFor: string | null;
}) {
  return act(CLIENTS, call("place_order", [input.dishId, input.quantity, input.comment, input.requestedFor]));
}

export async function cancelOrder(orderId: string) {
  return act(CLIENTS, call("cancel_order", [orderId]));
}

export async function acceptOrder(orderId: string, minutes: number) {
  return act(STAFF, call("accept_order", [orderId, minutes]));
}

export async function rejectOrder(orderId: string, reason: string | null) {
  return act(STAFF, call("reject_order", [orderId, reason]));
}

export async function startCooking(orderId: string) {
  return act(STAFF, call("start_cooking", [orderId]));
}

export async function extendOrderTimer(orderId: string, minutes: number) {
  return act(STAFF, call("extend_order_timer", [orderId, minutes]));
}

export async function markOrderReady(orderId: string) {
  return act(STAFF, call("mark_order_ready", [orderId]));
}

export async function handOverOrder(orderId: string) {
  return act(STAFF, call("hand_over_order", [orderId]));
}

export async function fetchBoard() {
  return act(STAFF, async (tx) => ({
    orders: await boardOrders(tx, kitchenDayStart().toISOString()),
    people: await peopleNames(tx),
    diets: await peopleDiets(tx),
  }));
}

export async function fetchMyActiveOrders() {
  return act(CLIENTS, (tx, me) => activeOrders(tx, me.id));
}

export async function fetchMyHistory(before: string | null) {
  return act(CLIENTS, (tx, me) => orderHistory(tx, me.id, before));
}

export async function fetchMyOrder(orderId: string) {
  return act(CLIENTS, async (tx, me) => ({
    order: await ownOrder(tx, me.id, orderId),
    events: await orderEvents(tx, orderId),
  }));
}
