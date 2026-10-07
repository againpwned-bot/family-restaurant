import "server-only";

// Every read the app makes, run inside asUser(): row level security decides
// what each person sees. Shared by the pages (first render) and the server
// actions the browser calls to refresh.

import { CLOSED_STATUSES, HISTORY_PAGE, OPEN_STATUSES } from "@/lib/orders";
import type { MenuDish } from "@/components/client/menu-types";
import { row, rows, type Tx } from "@/lib/server/database";
import type { Dish, DishIngredient, Order, OrderEvent, ShoppingCheck } from "@/lib/types";

const collator = new Intl.Collator("ro", { sensitivity: "base" });
/** Romanian alphabetical order ("Ș" after "S", not after "Z"). */
function byName<T extends { name: string }>(list: T[]): T[] {
  return list.sort((a, b) => collator.compare(a.name, b.name));
}

const INGREDIENTS_JSON = `coalesce((
  select jsonb_agg(jsonb_build_object('name', i.name, 'quantity', i.quantity, 'unit', i.unit, 'position', i.position)
                   order by i.position)
    from public.dish_ingredients i where i.dish_id = d.id), '[]'::jsonb) as dish_ingredients`;

const MENU_COLUMNS = `d.id, d.name, d.description, d.photo_path, d.photo_blur, d.photo_width, d.photo_height,
  d.cook_minutes, d.available_on, ${INGREDIENTS_JSON}`;

// --- dishes ----------------------------------------------------------------

export async function menuForDay(tx: Tx, day: string): Promise<MenuDish[]> {
  return byName(
    await rows<MenuDish>(
      tx,
      `select ${MENU_COLUMNS} from public.dishes d where d.available_on = $1 and d.archived_at is null`,
      [day],
    ),
  );
}

export async function menuDish(tx: Tx, id: string): Promise<MenuDish | null> {
  return row<MenuDish>(tx, `select ${MENU_COLUMNS} from public.dishes d where d.id = $1 and d.archived_at is null`, [
    id,
  ]);
}

export type MenuBoardDish = Pick<Dish, "id" | "name" | "photo_path" | "photo_blur" | "cook_minutes" | "available_on">;

export async function menuBoardDishes(tx: Tx): Promise<MenuBoardDish[]> {
  return byName(
    await rows<MenuBoardDish>(
      tx,
      `select id, name, photo_path, photo_blur, cook_minutes, available_on
         from public.dishes where archived_at is null`,
    ),
  );
}

export type CatalogueDish = Pick<
  Dish,
  "id" | "name" | "description" | "photo_path" | "photo_blur" | "cook_minutes" | "available_on"
> & { ingredient_count: number };

export async function catalogue(tx: Tx): Promise<CatalogueDish[]> {
  return byName(
    await rows<CatalogueDish>(
      tx,
      `select d.id, d.name, d.description, d.photo_path, d.photo_blur, d.cook_minutes, d.available_on,
              (select count(*)::int from public.dish_ingredients i where i.dish_id = d.id) as ingredient_count
         from public.dishes d where d.archived_at is null`,
    ),
  );
}

export type EditableDish = Dish & { dish_ingredients: Pick<DishIngredient, "name" | "quantity" | "unit" | "position">[] };

export async function editableDish(tx: Tx, id: string): Promise<EditableDish | null> {
  return row<EditableDish>(
    tx,
    `select d.*, ${INGREDIENTS_JSON} from public.dishes d where d.id = $1 and d.archived_at is null`,
    [id],
  );
}

export async function dishInfo(tx: Tx) {
  return rows<Pick<Dish, "id" | "cook_minutes" | "photo_blur">>(tx, "select id, cook_minutes, photo_blur from public.dishes");
}

// --- people ----------------------------------------------------------------

export async function peopleNames(tx: Tx): Promise<Record<string, string>> {
  const list = await rows<{ id: string; display_name: string }>(tx, "select id, display_name from public.profiles");
  return Object.fromEntries(list.map((p) => [p.id, p.display_name]));
}

// --- orders ----------------------------------------------------------------

/** Admin board: open orders of any day + everything placed since `since`. */
export async function boardOrders(tx: Tx, since: string): Promise<Order[]> {
  return rows<Order>(
    tx,
    `select * from public.orders where status = any($1::text[]::public.order_status[]) or created_at >= $2 order by created_at`,
    [[...OPEN_STATUSES], since],
  );
}

export async function activeOrders(tx: Tx, clientId: string): Promise<Order[]> {
  return rows<Order>(
    tx,
    `select * from public.orders where client_id = $1 and status = any($2::text[]::public.order_status[]) order by created_at`,
    [clientId, [...OPEN_STATUSES]],
  );
}

/** One page of finished orders, newest first, older than `before` if given. */
export async function orderHistory(tx: Tx, clientId: string, before?: string | null): Promise<Order[]> {
  return rows<Order>(
    tx,
    `select * from public.orders
      where client_id = $1 and status = any($2::text[]::public.order_status[]) and ($3::timestamptz is null or created_at < $3)
      order by created_at desc limit $4`,
    [clientId, [...CLOSED_STATUSES], before ?? null, HISTORY_PAGE],
  );
}

export async function ownOrder(tx: Tx, clientId: string, id: string): Promise<Order | null> {
  return row<Order>(tx, "select * from public.orders where id = $1 and client_id = $2", [id, clientId]);
}

export async function orderEvents(tx: Tx, orderId: string): Promise<OrderEvent[]> {
  return rows<OrderEvent>(tx, "select * from public.order_events where order_id = $1 order by created_at, id", [
    orderId,
  ]);
}

export async function dishAvailableOn(tx: Tx, dishId: string): Promise<string | null> {
  return (await row<{ available_on: string | null }>(tx, "select available_on from public.dishes where id = $1", [dishId]))
    ?.available_on ?? null;
}

// --- shopping list ---------------------------------------------------------

export type ShoppingData = {
  orders: Pick<Order, "dish_id" | "dish_name" | "quantity">[];
  ingredients: Pick<DishIngredient, "dish_id" | "name" | "quantity" | "unit">[];
  checks: ShoppingCheck[];
};

export async function shoppingData(tx: Tx, day: string): Promise<ShoppingData> {
  const orders = await rows<ShoppingData["orders"][number]>(
    tx,
    "select dish_id, dish_name, quantity from public.orders where status in ('accepted', 'cooking')",
  );
  const ids = [...new Set(orders.map((o) => o.dish_id).filter((id): id is string => !!id))];
  const ingredients = ids.length
    ? await rows<ShoppingData["ingredients"][number]>(
        tx,
        "select dish_id, name, quantity, unit from public.dish_ingredients where dish_id = any($1::uuid[])",
        [ids],
      )
    : [];
  const checks = await rows<ShoppingCheck>(tx, "select * from public.shopping_checks where day = $1", [day]);
  return { orders, ingredients, checks };
}
