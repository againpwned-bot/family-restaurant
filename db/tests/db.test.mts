// Applies db/bootstrap.sql and every migration to an in-memory database
// (the same code path the app uses), then checks row level security, the order
// flow, the admin helpers, push announcements and the live-update feed.
//
//   npm run test:db

import { openDatabase } from "../../lib/server/database";

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = await openDatabase(null, (m) => console.log(m));

const ids = {
  owner: "00000000-0000-0000-0000-000000000001",
  admin: "00000000-0000-0000-0000-000000000002",
  c1: "00000000-0000-0000-0000-000000000003",
  c2: "00000000-0000-0000-0000-000000000004",
};
await db.exec(`
insert into auth.users (id, password_hash) values ('${ids.owner}','x'),('${ids.admin}','x'),('${ids.c1}','x'),('${ids.c2}','x');
insert into public.profiles (id, username, display_name, role) values
 ('${ids.owner}','H4mbled','H4mbled','owner'),('${ids.admin}','Kretzofon','Kretzofon','admin'),
 ('${ids.c1}','Emil','Emil','client'),('${ids.c2}','MedaBetadina','Meda','client');
`);

let failures = 0;
type Who = keyof typeof ids | "anon";
// Same as withUser() in lib/server/database.ts; "anon" = a role with no rights at all.
async function as(who: Who, sql: string, params: unknown[] = []): Promise<{ rows: any[] }> {
  return db.transaction(async (tx) => {
    if (who === "anon") {
      await tx.exec("set local role anon");
    } else {
      await tx.query("select set_config('app.user_id', $1, true)", [ids[who]]);
      await tx.exec("set local role authenticated");
    }
    return tx.query<any>(sql, params);
  });
}
async function expectOk(label: string, who: Who, sql: string, params?: unknown[]): Promise<{ rows: any[] }> {
  try {
    const r = await as(who, sql, params);
    console.log("  ok  ", label);
    return r;
  } catch (e) {
    failures++;
    console.log("  FAIL", label, "->", (e as Error).message);
    return { rows: [{}] }; // later checks fail instead of crashing
  }
}
async function expectErr(label: string, who: Who, sql: string, match: string, params?: unknown[]) {
  try {
    await as(who, sql, params);
    failures++;
    console.log("  FAIL", label, "-> expected error", match);
  } catch (e) {
    const message = (e as Error).message;
    if (match && !message.includes(match)) {
      failures++;
      console.log("  FAIL", label, "-> wrong error:", message);
    } else console.log("  ok  ", label, `(${message})`);
  }
}
function check(label: string, cond: unknown, extra = "") {
  if (cond) console.log("  ok  ", label);
  else {
    failures++;
    console.log("  FAIL", label, extra);
  }
}

console.log("\n== dishes");
const d1 = (
  await expectOk(
    "admin inserts today's dish",
    "admin",
    `insert into public.dishes (name, cook_minutes, available_on) values ('Sarmale', 60, public.today_local()) returning id`,
  )
).rows[0].id;
const d2 = (
  await expectOk(
    "admin inserts off-menu dish",
    "admin",
    `insert into public.dishes (name) values ('Ciorbă') returning id`,
  )
).rows[0].id;
await expectOk(
  "admin inserts ingredients",
  "admin",
  `insert into public.dish_ingredients (dish_id, name, quantity, unit) values ($1,'Varză',0.25,'buc'),($1,'Carne tocată',200,'g'),($2,'Perișoare',6,'buc')`,
  [d1, d2],
);
await expectErr(
  "client cannot insert dish",
  "c1",
  `insert into public.dishes (name) values ('Hack')`,
  "row-level security",
);
let r: { rows: any[] } = await as("c1", `select name from public.dishes`);
check("client sees only today's menu", r.rows.length === 1 && r.rows[0].name === "Sarmale", JSON.stringify(r.rows));
r = await as("c1", `select name from public.dish_ingredients`);
check("client sees only today's ingredients", r.rows.length === 2, JSON.stringify(r.rows));
const anon = await as("anon", `select 1 from public.dishes`).catch((e: Error) => ({ err: e.message }));
check("anon cannot read dishes", "err" in anon && anon.err.includes("permission denied"), JSON.stringify(anon));

console.log("\n== profiles");
await expectErr(
  "client cannot change own role",
  "c1",
  `update public.profiles set role='owner' where id = auth.uid()`,
  "permission denied",
);
await expectOk("client changes own locale", "c1", `update public.profiles set locale='en' where id = auth.uid()`);
r = await as("c1", `update public.profiles set locale='en' where id = '${ids.c2}' returning id`);
check("client cannot update others' profile", r.rows.length === 0);
await expectErr(
  "client cannot insert profile",
  "c1",
  `insert into public.profiles (id, username, display_name) values ('${ids.c1}','x','x')`,
  "permission denied",
);

console.log("\n== orders");
await expectErr(
  "client cannot insert order directly",
  "c1",
  `insert into public.orders (client_id, dish_name) values (auth.uid(), 'x')`,
  "permission denied",
);
await expectErr("admin cannot place order", "admin", `select public.place_order($1, 1)`, "forbidden", [d1]);
await expectErr("cannot order off-menu dish", "c1", `select public.place_order($1, 1)`, "dish_unavailable", [d2]);
await expectErr("invalid quantity", "c1", `select public.place_order($1, 0)`, "invalid_quantity", [d1]);
const o1 = (
  await expectOk(
    "client places order",
    "c1",
    `select * from public.place_order($1, 2, '  fără smântână ', now() + interval '1 hour')`,
    [d1],
  )
).rows[0];
check(
  "comment trimmed + snapshot",
  o1.comment === "fără smântână" && o1.dish_name === "Sarmale" && o1.status === "received",
);
r = await db.query(`select recipient_id, type, payload from public.notifications order by created_at`);
check(
  "new order notifies owner + admin",
  r.rows.length === 2 && r.rows.every((n) => n.type === "order_new"),
  JSON.stringify(r.rows),
);
check("payload has client + dish", r.rows[0].payload.client === "Emil" && r.rows[0].payload.dish === "Sarmale");
r = await as("c2", `select id from public.orders`);
check("other client cannot see the order", r.rows.length === 0);
r = await as("c2", `select id from public.notifications`);
check("other client sees no notifications", r.rows.length === 0);
r = await as("admin", `select id from public.notifications`);
check("admin sees own notification only", r.rows.length === 1);
await expectErr("client cannot accept", "c1", `select public.accept_order($1, 30)`, "forbidden", [o1.id]);
await expectErr("client cannot cancel others' order", "c2", `select public.cancel_order($1)`, "order_not_found", [
  o1.id,
]);
await expectErr("cannot cook before accepting", "admin", `select public.start_cooking($1)`, "invalid_transition", [
  o1.id,
]);
const acc = (await expectOk("admin accepts with 30 min", "admin", `select * from public.accept_order($1, 30)`, [o1.id]))
  .rows[0];
check("decided_by = admin, eta set", acc.decided_by === ids.admin && acc.eta_at && acc.timer_minutes === 30);
r = await as("c1", `select type, payload from public.notifications`);
check(
  "client got order_accepted",
  r.rows.length === 1 && r.rows[0].type === "order_accepted" && r.rows[0].payload.minutes === 30,
  JSON.stringify(r.rows),
);
await expectOk("admin extends +10", "admin", `select public.extend_order_timer($1, 10)`, [o1.id]);
r = await as("c1", `select type, payload from public.notifications where type = 'order_extended'`);
check(
  "client got order_extended (+10)",
  r.rows.length === 1 && Number(r.rows[0].payload.minutes) === 10,
  JSON.stringify(r.rows),
);
await expectOk("admin starts cooking", "admin", `select public.start_cooking($1)`, [o1.id]);
await expectErr("client cannot cancel while cooking", "c1", `select public.cancel_order($1)`, "cannot_cancel", [o1.id]);
await expectOk("admin marks ready", "admin", `select public.mark_order_ready($1)`, [o1.id]);
r = await as("c1", `select type from public.notifications where type = 'order_ready'`);
check("client got order_ready", r.rows.length === 1);
await expectOk("admin hands over", "admin", `select public.hand_over_order($1)`, [o1.id]);
r = await as("c1", `select kind from public.order_events where order_id = $1 order by id`, [o1.id]);
check(
  "timeline",
  r.rows.map((x) => x.kind).join(",") === "created,accepted,extended,cooking,ready,handed_over",
  JSON.stringify(r.rows),
);

const o2 = (await as("c2", `select * from public.place_order($1, 1)`, [d1])).rows[0];
await expectOk("admin accepts o2", "admin", `select public.accept_order($1, 20)`, [o2.id]);
await expectOk("client cancels accepted order", "c2", `select public.cancel_order($1)`, [o2.id]);
r = await db.query(`select recipient_id from public.notifications where type='order_cancelled'`);
check("cancellation notifies owner + admin", r.rows.length === 2);
const o3 = (await as("c2", `select * from public.place_order($1, 1)`, [d1])).rows[0];
await expectOk("admin rejects with reason", "admin", `select public.reject_order($1, 'Nu mai am varză')`, [o3.id]);
r = await as("c2", `select payload from public.notifications where type='order_rejected'`);
check("client got rejection reason", r.rows[0]?.payload.reason === "Nu mai am varză", JSON.stringify(r.rows));
const o4 = (await as("owner", `select * from public.place_order($1, 1)`, [d1])).rows[0];
r = await db.query(`select recipient_id from public.notifications where order_id = $1`, [o4.id]);
check(
  "owner ordering himself: only admin notified",
  r.rows.length === 1 && r.rows[0].recipient_id === ids.admin,
  JSON.stringify(r.rows),
);

console.log("\n== shopping + push + auth schema");
await expectErr(
  "client cannot tick shopping list",
  "c1",
  `insert into public.shopping_checks (item_key) values ('varză|buc')`,
  "row-level security",
);
await expectOk(
  "admin ticks shopping list",
  "admin",
  `insert into public.shopping_checks (item_key, quantity) values ('varză|buc', 1)`,
);
await expectOk(
  "client registers push",
  "c1",
  `select public.register_push_subscription('https://fcm.googleapis.com/x', 'k', 'a', 'UA')`,
);
await expectOk(
  "same endpoint moves to c2",
  "c2",
  `select public.register_push_subscription('https://fcm.googleapis.com/x', 'k', 'a', 'UA')`,
);
r = await as("c1", `select id from public.push_subscriptions`);
check("c1 lost the endpoint", r.rows.length === 0);
await expectErr(
  "bad endpoint rejected",
  "c1",
  `select public.register_push_subscription('http://evil', 'k', 'a')`,
  "invalid_subscription",
);
await expectErr("client cannot read password hashes", "c1", `select password_hash from auth.users`, "permission denied");
await expectErr("owner cannot read password hashes", "owner", `select password_hash from auth.users`, "permission denied");
await expectErr("client cannot read sessions", "c1", `select id from auth.sessions`, "permission denied");
await expectErr("client cannot forge a session", "c1", `insert into auth.sessions (user_id) values (auth.uid())`, "permission denied");
await expectErr("client cannot read migrations", "c1", `select name from internal.migrations`, "permission denied");
await expectErr("anon cannot call RPC", "anon", `select public.place_order($1, 1)`, "permission denied", [d1]);

console.log("\n== admin helpers");
const ingredients = JSON.stringify([{ name: " Varză ", quantity: 1, unit: "buc" }, { name: "Sare", quantity: null, unit: "" }]);
await expectErr("client cannot save_dish", "c1", `select * from public.save_dish(null, 'X', '', 10, true, null, null, null, null, $1::jsonb)`, "forbidden", [ingredients]);
const nd = (await expectOk("admin creates dish with ingredients", "admin",
  `select * from public.save_dish(null, ' Ciorbă de burtă ', 'Bună', 50, true, 'dishes/a.webp', 1600, 1200, null, $1::jsonb)`, [ingredients])).rows[0];
check("name trimmed, on today's menu", nd.name === "Ciorbă de burtă" && nd.available_on !== null);
r = await db.query(`select name, quantity, position from public.dish_ingredients where dish_id = $1 order by position`, [nd.id]);
check("ingredients saved in order, trimmed, null qty kept", r.rows.length === 2 && r.rows[0].name === "Varză" && r.rows[1].quantity === null, JSON.stringify(r.rows));
await expectOk("admin updates dish, replaces ingredients, takes it off today's menu", "admin",
  `select * from public.save_dish($1, 'Ciorbă de burtă', 'Bună', 55, false, null, null, null, null, '[{"name":"Burtă","quantity":200,"unit":"g"}]'::jsonb)`, [nd.id]);
r = await db.query(`select d.available_on, d.cook_minutes, (select count(*)::int from public.dish_ingredients i where i.dish_id = d.id) as n from public.dishes d where id = $1`, [nd.id]);
check("update applied", r.rows[0].available_on === null && r.rows[0].cook_minutes === 55 && r.rows[0].n === 1, JSON.stringify(r.rows));
await expectOk("toggle available today on", "admin", `select * from public.set_dish_available_today($1, true)`, [nd.id]);
await expectErr("client cannot toggle menu", "c1", `select * from public.set_dish_available_today($1, false)`, "forbidden", [nd.id]);
await db.query(`update public.dishes set available_on = public.today_local() - 1 where id = $1`, [d2]);
r = await as("admin", `select public.copy_yesterday_menu() as n`);
check("copy yesterday's menu", r.rows[0].n === 1, JSON.stringify(r.rows));
r = await as("admin", `select public.delete_dish($1) as res`, [d1]);
check("ordered dish is archived, not deleted", r.rows[0].res.mode === "archived", JSON.stringify(r.rows));
r = await as("c1", `select count(*)::int as n from public.orders where dish_id = $1`, [d1]);
check("order history still linked to archived dish", r.rows[0].n >= 1);
r = await as("admin", `select public.delete_dish($1) as res`, [nd.id]);
check("unordered dish is deleted and returns its photo", r.rows[0].res.mode === "deleted", JSON.stringify(r.rows));
await expectOk("admin ticks via set_shopping_check", "admin", `select public.set_shopping_check('burtă|g', true, 200)`);
await expectErr("client cannot tick via function", "c1", `select public.set_shopping_check('x', true)`, "forbidden");
await expectOk("admin resets ticks", "admin", `select public.reset_shopping_checks()`);
r = await db.query(`select count(*)::int as n from public.shopping_checks`);
check("ticks cleared", r.rows[0].n === 0);
await expectErr("anon cannot call admin helpers", "anon", `select public.clear_today_menu()`, "permission denied");

console.log("\n== push + live updates (pg_notify)");
const pushed: string[] = [];
const changes: { table: string; type: string; pk: Record<string, unknown> }[] = [];
await db.listen("push", (id) => pushed.push(id));
await db.listen("changes", (payload) => changes.push(JSON.parse(payload)));
await db.query(`update public.dishes set available_on = public.today_local(), archived_at = null where id = $1`, [d1]);
changes.length = 0;
const pushOrder = (await as("c1", `select * from public.place_order($1, 1)`, [d1])).rows[0];
await new Promise((resolve) => setTimeout(resolve, 50));
r = await db.query(`select id from public.notifications where order_id = $1 order by id`, [pushOrder.id]);
check("one push announcement per staff recipient", pushed.length === 2, JSON.stringify(pushed));
check(
  "announcements carry the notification ids",
  JSON.stringify([...pushed].sort()) === JSON.stringify(r.rows.map((n) => n.id).sort()),
);
check(
  "order insert is on the change feed with its id",
  changes.some((c) => c.table === "orders" && c.type === "INSERT" && c.pk.id === pushOrder.id),
  JSON.stringify(changes),
);
check(
  "timeline + notifications are on the change feed too",
  changes.some((c) => c.table === "order_events") && changes.some((c) => c.table === "notifications"),
);
changes.length = 0;
await as("admin", `select public.set_shopping_check('ceapă|buc', true, 1)`);
await new Promise((resolve) => setTimeout(resolve, 50));
check(
  "shopping ticks are keyed by day + item",
  changes.some((c) => c.table === "shopping_checks" && c.pk.item_key === "ceapă|buc" && typeof c.pk.day === "string"),
  JSON.stringify(changes),
);
pushed.length = 0;
await expectOk("anyone signed in can send themselves a test", "c2", `select public.send_test_notification()`);
r = await db.query(`select count(*)::int as n from public.notifications where type = 'test' and recipient_id = $1`, [ids.c2]);
check("test notification created", r.rows[0].n === 1);
await new Promise((resolve) => setTimeout(resolve, 50));
check("test notification is pushed", pushed.length === 1);
await expectErr("nobody calls the push trigger directly", "c1", `select public.notifications_send_push()`, "permission denied");

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL CHECKS PASSED");
await db.close();
process.exit(failures ? 1 : 0);
