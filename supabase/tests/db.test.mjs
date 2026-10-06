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

const stub = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant anon, authenticated, service_role to postgres;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public bool, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid() primary key, bucket_id text, name text);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant all on storage.objects to authenticated;
create publication supabase_realtime;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;
await db.exec(stub);

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

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL CHECKS PASSED");
process.exit(failures ? 1 : 0);
