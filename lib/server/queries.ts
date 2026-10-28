import "server-only";

import { CLOSED_STATUSES, HISTORY_PAGE, OPEN_STATUSES } from "@/lib/orders";
import type { MenuDish } from "@/components/client/menu-types";
import { row, rows, type Tx } from "@/lib/server/database";
import type {
  AppSettings,
  Broadcast,
  ChatMessage,
  DietInfo,
  DietTag,
  Dish,
  DishIngredient,
  Json,
  Order,
  OrderEvent,
  OrderStatus,
  Profile,
  ShoppingCheck,
} from "@/lib/types";

const collator = new Intl.Collator("ro", { sensitivity: "base" });
function byName<T extends { name: string }>(list: T[]): T[] {
  return list.sort((a, b) => collator.compare(a.name, b.name));
}

const INGREDIENTS_JSON = `coalesce((
  select jsonb_agg(jsonb_build_object('name', i.name, 'quantity', i.quantity, 'unit', i.unit, 'position', i.position)
                   order by i.position)
    from public.dish_ingredients i where i.dish_id = d.id), '[]'::jsonb) as dish_ingredients`;

const MENU_COLUMNS = `d.id, d.name, d.description, d.photo_path, d.photo_blur, d.photo_width, d.photo_height,
  d.cook_minutes, d.available_on, d.tags, d.meal, ${INGREDIENTS_JSON}`;

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

export type MenuBoardDish = Pick<
  Dish,
  "id" | "name" | "photo_path" | "photo_blur" | "cook_minutes" | "available_on" | "tags" | "meal"
>;

export async function menuBoardDishes(tx: Tx): Promise<MenuBoardDish[]> {
  return byName(
    await rows<MenuBoardDish>(
      tx,
      `select id, name, photo_path, photo_blur, cook_minutes, available_on, tags, meal
         from public.dishes where archived_at is null`,
    ),
  );
}

export type CatalogueDish = Pick<
  Dish,
  "id" | "name" | "description" | "photo_path" | "photo_blur" | "cook_minutes" | "available_on" | "tags" | "meal"
> & { ingredient_count: number };

export async function catalogue(tx: Tx): Promise<CatalogueDish[]> {
  return byName(
    await rows<CatalogueDish>(
      tx,
      `select d.id, d.name, d.description, d.photo_path, d.photo_blur, d.cook_minutes, d.available_on, d.tags, d.meal,
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

export async function peopleNames(tx: Tx): Promise<Record<string, string>> {
  const list = await rows<{ id: string; display_name: string }>(tx, "select id, display_name from public.profiles");
  return Object.fromEntries(list.map((p) => [p.id, p.display_name]));
}

export type PersonInfo = Pick<Profile, "id" | "display_name" | "avatar_path" | "role" | "allergies" | "diet_tags">;
export type { DietInfo };

export async function peopleInfo(tx: Tx): Promise<PersonInfo[]> {
  return rows<PersonInfo>(
    tx,
    `select id, display_name, avatar_path, role, allergies, diet_tags from public.profiles
      where disabled_at is null order by display_name`,
  );
}

export async function peopleDiets(tx: Tx): Promise<Record<string, DietInfo>> {
  const list = await rows<{ id: string; allergies: string; diet_tags: DietTag[] }>(
    tx,
    "select id, allergies, diet_tags from public.profiles where allergies <> '' or cardinality(diet_tags) > 0",
  );
  return Object.fromEntries(list.map((p) => [p.id, { allergies: p.allergies, tags: p.diet_tags }]));
}

export async function appSettings(tx: Tx): Promise<AppSettings> {
  return (await row<AppSettings>(
    tx,
    `select require_push, to_char(cutoff_breakfast, 'HH24:MI') as cutoff_breakfast,
            to_char(cutoff_lunch, 'HH24:MI') as cutoff_lunch, to_char(cutoff_dinner, 'HH24:MI') as cutoff_dinner,
            to_char(cutoff_all, 'HH24:MI') as cutoff_all, updated_at
       from public.app_settings`,
  ))!;
}

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

// ---- Order history ------------------------------------------------------------------------

export type HistoryFilters = {
  from: string | null;
  to: string | null;
  person: string | null;
  dish: string | null;
  status: OrderStatus | null;
};

export type HistoryOrder = Order & { client_name: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES: OrderStatus[] = ["received", "accepted", "cooking", "ready", "handed_over", "rejected", "cancelled"];

export function cleanHistoryFilters(input: Partial<Record<keyof HistoryFilters, unknown>>): HistoryFilters {
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const from = text(input.from);
  const to = text(input.to);
  const person = text(input.person);
  const status = text(input.status);
  return {
    from: from && DAY.test(from) ? from : null,
    to: to && DAY.test(to) ? to : null,
    person: person && UUID.test(person) ? person : null,
    dish: text(input.dish)?.slice(0, 80) ?? null,
    status: status && (STATUSES as string[]).includes(status) ? (status as OrderStatus) : null,
  };
}

export async function searchOrders(
  tx: Tx,
  f: HistoryFilters,
  beforeNumber: number | null,
  limit = 30,
): Promise<HistoryOrder[]> {
  const dish = f.dish ? `%${f.dish.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  return rows<HistoryOrder>(
    tx,
    `select o.*, coalesce(p.display_name, '?') as client_name
       from public.orders o left join public.profiles p on p.id = o.client_id
      where ($1::date is null or o.created_at >= ($1::date::timestamp at time zone 'Europe/Bucharest'))
        and ($2::date is null or o.created_at < (($2::date + 1)::timestamp at time zone 'Europe/Bucharest'))
        and ($3::uuid is null or o.client_id = $3)
        and ($4::text is null or o.dish_name ilike $4)
        and ($5::text is null or o.status = $5::public.order_status)
        and ($6::bigint is null or o.number < $6)
      order by o.number desc
      limit $7`,
    [f.from, f.to, f.person, dish, f.status, beforeNumber, limit],
  );
}

// ---- Stats ------------------------------------------------------------------------------------

export type OrderStats = {
  totals: {
    orders: number;
    portions: number;
    handed_over: number;
    rejected: number;
    cancelled: number;
    people: number;
    avg_ready_minutes: number | null;
  };
  perDay: { day: string; orders: number; portions: number }[];
  byHour: { hour: number; orders: number }[];
  topDishes: { name: string; orders: number; portions: number }[];
  topPeople: { id: string; name: string; orders: number }[];
};

export async function orderStats(tx: Tx, days: number): Promise<OrderStats> {
  const since = `(((now() at time zone 'Europe/Bucharest')::date - ($1::int - 1))::timestamp at time zone 'Europe/Bucharest')`;
  const totals = (await row<OrderStats["totals"]>(
    tx,
    `select count(*)::int as orders,
            coalesce(sum(quantity), 0)::int as portions,
            count(*) filter (where status = 'handed_over')::int as handed_over,
            count(*) filter (where status = 'rejected')::int as rejected,
            count(*) filter (where status = 'cancelled')::int as cancelled,
            count(distinct client_id)::int as people,
            round((avg(extract(epoch from (ready_at - created_at))) filter (where ready_at is not null) / 60)::numeric, 1)
              as avg_ready_minutes
       from public.orders where created_at >= ${since}`,
    [days],
  ))!;
  const perDay = await rows<OrderStats["perDay"][number]>(
    tx,
    `select to_char(d, 'YYYY-MM-DD') as day,
            count(o.id)::int as orders, coalesce(sum(o.quantity), 0)::int as portions
       from generate_series((now() at time zone 'Europe/Bucharest')::date - ($1::int - 1),
                            (now() at time zone 'Europe/Bucharest')::date, interval '1 day') d
       left join public.orders o on (o.created_at at time zone 'Europe/Bucharest')::date = d::date
      group by d order by d`,
    [days],
  );
  const byHour = await rows<OrderStats["byHour"][number]>(
    tx,
    `select h as hour, count(o.id)::int as orders
       from generate_series(0, 23) h
       left join public.orders o
         on extract(hour from o.created_at at time zone 'Europe/Bucharest') = h and o.created_at >= ${since}
      group by h order by h`,
    [days],
  );
  const topDishes = await rows<OrderStats["topDishes"][number]>(
    tx,
    `select dish_name as name, count(*)::int as orders, sum(quantity)::int as portions
       from public.orders where created_at >= ${since} and status not in ('rejected', 'cancelled')
      group by dish_name order by portions desc, orders desc, dish_name limit 8`,
    [days],
  );
  const topPeople = await rows<OrderStats["topPeople"][number]>(
    tx,
    `select o.client_id as id, coalesce(p.display_name, '?') as name, count(*)::int as orders
       from public.orders o left join public.profiles p on p.id = o.client_id
      where o.created_at >= ${since}
      group by o.client_id, p.display_name order by orders desc, name limit 8`,
    [days],
  );
  return { totals, perDay, byHour, topDishes, topPeople };
}

// ---- Per-user activity -----------------------------------------------------------------------

export type UserActivity = {
  profile: Profile;
  totals: { orders: number; portions: number; handed_over: number; rejected: number; cancelled: number };
  favourites: { name: string; orders: number; portions: number }[];
  recent: Order[];
  firstOrderAt: string | null;
};

export async function userActivity(tx: Tx, id: string): Promise<UserActivity | null> {
  const profile = await row<Profile>(tx, "select * from public.profiles where id = $1", [id]);
  if (!profile) return null;
  const totals = (await row<UserActivity["totals"] & { first_at: string | null }>(
    tx,
    `select count(*)::int as orders, coalesce(sum(quantity), 0)::int as portions,
            count(*) filter (where status = 'handed_over')::int as handed_over,
            count(*) filter (where status = 'rejected')::int as rejected,
            count(*) filter (where status = 'cancelled')::int as cancelled,
            min(created_at) as first_at
       from public.orders where client_id = $1`,
    [id],
  ))!;
  const favourites = await rows<UserActivity["favourites"][number]>(
    tx,
    `select dish_name as name, count(*)::int as orders, sum(quantity)::int as portions
       from public.orders where client_id = $1 and status not in ('rejected', 'cancelled')
      group by dish_name order by portions desc, orders desc, dish_name limit 5`,
    [id],
  );
  const recent = await rows<Order>(
    tx,
    "select * from public.orders where client_id = $1 order by created_at desc limit 15",
    [id],
  );
  const { first_at, ...rest } = totals;
  return { profile, totals: rest, favourites, recent, firstOrderAt: first_at };
}

// ---- Menu planner ----------------------------------------------------------------------------

export type MenuTemplate = { id: string; name: string; dish_ids: string[]; created_at: string };

export async function plannerData(tx: Tx, from: string, days: number) {
  return {
    plan: await rows<{ day: string; dish_id: string }>(
      tx,
      `select to_char(p.day, 'YYYY-MM-DD') as day, p.dish_id
         from public.menu_plan p join public.dishes d on d.id = p.dish_id
        where d.archived_at is null and p.day between $1::date and $1::date + ($2::int - 1)`,
      [from, days],
    ),
    templates: await rows<MenuTemplate>(
      tx,
      "select id, name, dish_ids, created_at from public.menu_templates order by name",
    ),
  };
}

// ---- Chat ------------------------------------------------------------------------------------

export type ConversationSummary = {
  conversation: string;
  last_at: string;
  last_body: string;
  last_sender: string;
  unread: number;
};

export async function chatConversations(tx: Tx, me: string): Promise<ConversationSummary[]> {
  return rows<ConversationSummary>(
    tx,
    `with last as (
       select distinct on (conversation) conversation, created_at as last_at, body as last_body, sender_id as last_sender
         from public.chat_messages order by conversation, created_at desc
     )
     select l.*,
            (select count(*)::int from public.chat_messages m
              where m.conversation = l.conversation and m.sender_id <> $1
                and m.created_at > coalesce((select r.last_read_at from public.chat_reads r
                                              where r.user_id = $1 and r.conversation = l.conversation), '-infinity'))
              as unread
       from last l order by l.last_at desc`,
    [me],
  );
}

export async function chatMessages(tx: Tx, conversation: string, before: string | null, limit = 50) {
  const list = await rows<ChatMessage>(
    tx,
    `select id, conversation, sender_id, body, created_at from public.chat_messages
      where conversation = $1 and ($2::timestamptz is null or created_at < $2)
      order by created_at desc limit $3`,
    [conversation, before, limit],
  );
  return list.reverse();
}

export async function chatUnreadTotal(tx: Tx, me: string): Promise<number> {
  return (
    (await row<{ n: number }>(
      tx,
      `select count(*)::int as n from public.chat_messages m
        where m.sender_id <> $1
          and m.created_at > coalesce((select r.last_read_at from public.chat_reads r
                                        where r.user_id = $1 and r.conversation = m.conversation), '-infinity')`,
      [me],
    ))?.n ?? 0
  );
}

// ---- Announcements ---------------------------------------------------------------------------

export async function recentBroadcasts(tx: Tx, limit = 20): Promise<(Broadcast & { sender_name: string | null })[]> {
  return rows(
    tx,
    `select b.*, p.display_name as sender_name
       from public.broadcasts b left join public.profiles p on p.id = b.sent_by
      order by b.created_at desc limit $1`,
    [limit],
  );
}

// ---- Audit log -------------------------------------------------------------------------------

export const AUDIT_ENTITIES = ["dish", "user", "order", "template", "settings", "broadcast"] as const;
export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

export type AuditRow = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity: AuditEntity;
  entity_id: string | null;
  label: string | null;
  changes: Json;
  created_at: string;
};

export async function auditEntries(
  tx: Tx,
  entity: AuditEntity | null,
  before: string | null,
  limit = 50,
): Promise<AuditRow[]> {
  return rows<AuditRow>(
    tx,
    `select x.*, p.display_name as actor_name from (
       select 'a' || a.id::text as id, a.actor_id, a.action, a.entity, a.entity_id, a.label, a.changes, a.created_at
         from public.audit_log a
       union all
       select 'o' || e.id::text, e.actor_id, e.kind, 'order', e.order_id::text,
              '#' || o.number || ' ' || o.dish_name, e.data, e.created_at
         from public.order_events e join public.orders o on o.id = e.order_id
     ) x left join public.profiles p on p.id = x.actor_id
     where ($1::text is null or x.entity = $1) and ($2::timestamptz is null or x.created_at < $2)
     order by x.created_at desc, x.id desc limit $3`,
    [entity, before, limit],
  );
}
