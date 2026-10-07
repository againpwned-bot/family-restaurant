"use server";

import { kitchenDate } from "@/lib/dates";
import { act } from "@/lib/server/action";
import { shoppingData } from "@/lib/server/queries";

const STAFF = ["owner", "admin"] as const;

export async function fetchShopping() {
  return act(STAFF, (tx) => shoppingData(tx, kitchenDate()));
}

export async function setShoppingCheck(itemKey: string, checked: boolean, quantity: number | null) {
  return act(STAFF, async (tx) => {
    await tx.query("select public.set_shopping_check($1, $2, $3)", [itemKey, checked, quantity]);
    return true;
  });
}

export async function resetShoppingChecks() {
  return act(STAFF, async (tx) => {
    await tx.query("select public.reset_shopping_checks()");
    return true;
  });
}
