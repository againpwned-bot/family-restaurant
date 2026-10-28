"use server";

import { act } from "@/lib/server/action";
import { row } from "@/lib/server/database";
import { menuBoardDishes, plannerData, type MenuTemplate } from "@/lib/server/queries";

const STAFF = ["owner", "admin"] as const;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function day(value: string) {
  if (!DAY.test(value)) throw new Error("invalid_day");
  return value;
}

export async function fetchPlanner(from: string, days: number) {
  return act(STAFF, async (tx) => ({
    ...(await plannerData(tx, day(from), Math.min(Math.max(days, 1), 14))),
    dishes: await menuBoardDishes(tx),
  }));
}

export async function setMenuPlan(date: string, dishId: string, on: boolean) {
  return act(STAFF, async (tx) => {
    await tx.query("select public.set_menu_plan($1::date, $2, $3)", [day(date), dishId, on]);
    return true;
  });
}

export async function copyMenuDays(from: string, to: string, days: number) {
  return act(
    STAFF,
    async (tx) =>
      (await row<{ n: number }>(tx, "select public.copy_menu_days($1::date, $2::date, $3) as n", [
        day(from),
        day(to),
        days,
      ]))!.n,
  );
}

export async function clearMenuDay(date: string) {
  return act(STAFF, async (tx) => (await row<{ n: number }>(tx, "select public.clear_menu_day($1::date) as n", [day(date)]))!.n);
}

export async function saveMenuTemplate(name: string, date: string) {
  return act(STAFF, async (tx) =>
    (await row<MenuTemplate>(
      tx,
      "select id, name, dish_ids, created_at from public.save_menu_template($1, $2::date)",
      [name.slice(0, 60), day(date)],
    ))!,
  );
}

export async function applyMenuTemplate(id: string, date: string) {
  return act(
    STAFF,
    async (tx) =>
      (await row<{ n: number }>(tx, "select public.apply_menu_template($1, $2::date) as n", [id, day(date)]))!.n,
  );
}

export async function deleteMenuTemplate(id: string) {
  return act(STAFF, async (tx) => {
    await tx.query("select public.delete_menu_template($1)", [id]);
    return true;
  });
}
