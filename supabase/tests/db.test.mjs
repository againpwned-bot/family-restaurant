import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

// Runs every migration in an in-memory Postgres (PGlite) with minimal stand-ins
// for the Supabase auth/storage schemas, then checks RLS and the order flow.
//
//   npm run test:db
const root = process.cwd();
const migDir = path.join(root, "supabase/migrations");
const db = new PGlite();

// Same Supabase stand-ins as the local emulator.
await db.exec(fs.readFileSync(path.join(root, "dev/local-supabase/bootstrap.sql"), "utf8"));

for (const f of fs.readdirSync(migDir).sort()) {
  if (!f.endsWith(".sql")) continue;
  try {
    await db.exec(fs.readFileSync(path.join(migDir, f), "utf8"));
    console.log("applied", f);
  } catch (e) {
    console.error("FAILED", f, e.message);
    process.exit(1);
  }
}

const ids = {
  owner: "00000000-0000-0000-0000-000000000001",
  admin: "00000000-0000-0000-0000-000000000002",
  c1: "00000000-0000-0000-0000-000000000003",
  c2: "00000000-0000-0000-0000-000000000004",
};
await db.exec(`
insert into auth.users values ('${ids.owner}','h4mbled@meniu.local'),('${ids.admin}','kretzofon@meniu.local'),
 ('${ids.c1}','emil@meniu.local'),('${ids.c2}','medabetadina@meniu.local');
insert into public.profiles (id, username, display_name, role) values
 ('${ids.owner}','H4mbled','H4mbled','owner'),('${ids.admin}','Kretzofon','Kretzofon','admin'),
 ('${ids.c1}','Emil','Emil','client'),('${ids.c2}','MedaBetadina','Meda','client');
`);

let failures = 0;
async function as(who, sql, params = []) {
  await db.exec("reset role");
  if (who === "anon") {
    await db.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  } else {
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${ids[who]}', false);`);
  }
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}
async function expectOk(label, who, sql, params) {
  try {
    const r = await as(who, sql, params);
    console.log("  ok  ", label);
    return r;
  } catch (e) {
    failures++;
    console.log("  FAIL", label, "->", e.message);
  }
}
async function expectErr(label, who, sql, match, params) {
  try {
    await as(who, sql, params);
    failures++;
    console.log("  FAIL", label, "-> expected error", match);
  } catch (e) {
    if (match && !e.message.includes(match)) {
      failures++;
      console.log("  FAIL", label, "-> wrong error:", e.message);
    } else console.log("  ok  ", label, `(${e.message})`);
  }
}
function check(label, cond, extra = "") {
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
let r = await as("c1", `select name from public.dishes`);
check("client sees only today's menu", r.rows.length === 1 && r.rows[0].name === "Sarmale", JSON.stringify(r.rows));
r = await as("c1", `select name from public.dish_ingredients`);
check("client sees only today's ingredients", r.rows.length === 2, JSON.stringify(r.rows));
r = await as("anon", `select 1 from public.dishes`).catch((e) => ({ err: e.message }));
check("anon cannot read dishes", r.err?.includes("permission denied"), JSON.stringify(r));

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

console.log("\n== shopping + push + storage");
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
await expectErr(
  "client cannot upload photos",
  "c1",
  `insert into storage.objects (bucket_id, name) values ('dish-photos','x.webp')`,
  "row-level security",
);
await expectOk(
  "admin uploads photo",
  "admin",
  `insert into storage.objects (bucket_id, name) values ('dish-photos','x.webp')`,
);
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

console.log("\n== push webhook");
const calls = [];
await db.listen("_local_http", (payload) => calls.push(JSON.parse(payload)));
await db.query(`insert into vault.secrets (name, secret) values ('project_url', 'https://abc.supabase.co/'), ('push_webhook_secret', 's3cret')`);
await db.query(`update public.dishes set available_on = public.today_local(), archived_at = null where id = $1`, [d1]);
const pushOrder = (await as("c1", `select * from public.place_order($1, 1)`, [d1])).rows[0];
await new Promise((r) => setTimeout(r, 50));
check("one webhook per staff recipient", calls.length === 2, JSON.stringify(calls.map((c) => c.url)));
check("webhook goes to the send-push function", calls[0]?.url === "https://abc.supabase.co/functions/v1/send-push");
check("webhook carries the shared secret", calls[0]?.headers?.Authorization === "Bearer s3cret");
check("webhook body is the notification row", calls[0]?.body?.record?.type === "order_new" && calls[0]?.body?.record?.order_id === pushOrder.id);
await expectOk("anyone signed in can send themselves a test", "c2", `select public.send_test_notification()`);
r = await db.query(`select count(*)::int as n from public.notifications where type = 'test' and recipient_id = $1`, [ids.c2]);
check("test notification created", r.rows[0].n === 1);
await db.query(`delete from vault.secrets`);
calls.length = 0;
await as("c1", `select * from public.place_order($1, 1)`, [d1]);
await new Promise((r) => setTimeout(r, 50));
check("without Vault secrets the trigger stays quiet (in-app only)", calls.length === 0);

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL CHECKS PASSED");
process.exit(failures ? 1 : 0);
