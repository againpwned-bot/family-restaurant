import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import webpush from "web-push";

import { openDatabase, row, withUser, type Db } from "../lib/server/database";
import { renderPush, startPushWorker } from "../lib/server/push";

process.env.MENIU_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "meniu-push-"));

type Sent = {
  endpoint: string;
  payload: { title: string; body: string; url: string; type: string; lang: string; tag: string };
  options: { urgency?: string; TTL?: number };
};
const sent: Sent[] = [];
const GONE = "https://push.example/gone";

webpush.sendNotification = (async (subscription, payload, options) => {
  sent.push({ endpoint: subscription.endpoint, payload: JSON.parse(String(payload)), options: options ?? {} });
  if (subscription.endpoint === GONE) throw Object.assign(new Error("Gone"), { statusCode: 410 });
  return { statusCode: 201, body: "", headers: {} };
}) as typeof webpush.sendNotification;

const ids = {
  owner: "00000000-0000-0000-0000-0000000000a1",
  admin: "00000000-0000-0000-0000-0000000000a2",
  client: "00000000-0000-0000-0000-0000000000a3",
};
let db: Db;
let dishId: string;

async function until<T>(fn: () => T | undefined | null | false, ms = 5000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const value = fn();
    if (value) return value;
    if (Date.now() > end) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 20));
  }
}

const as = <T>(who: keyof typeof ids, sql: string, params: unknown[] = []) =>
  withUser(db, ids[who], (tx) => row<T>(tx, sql, params));

const subscribe = (who: keyof typeof ids, endpoint: string) =>
  as(who, "select public.register_push_subscription($1, $2, $3, $4)", [endpoint, "p256dh-key", "auth-key", "test"]);

before(async () => {
  db = await openDatabase(null);
  await db.exec(`
    insert into auth.users (id, password_hash) values ('${ids.owner}', 'x'), ('${ids.admin}', 'x'), ('${ids.client}', 'x');
    insert into public.profiles (id, username, display_name, role) values
      ('${ids.owner}', 'Owner', 'Tata', 'owner'),
      ('${ids.admin}', 'Cook', 'Bucătarul', 'admin'),
      ('${ids.client}', 'Emil', 'Emil', 'client');
  `);
  dishId = (await row<{ id: string }>(
    db,
    "insert into public.dishes (name, cook_minutes, available_on) values ('Sarmale cu mămăligă', 60, public.today_local()) returning id",
  ))!.id;
  await startPushWorker(db);
});

after(async () => {
  await db.close();
  fs.rmSync(process.env.MENIU_DATA_DIR!, { recursive: true, force: true });
});

test("a new order is pushed to the kitchen, urgently", async () => {
  await subscribe("admin", "https://push.example/kitchen");
  const order = await as<{ id: string }>("client", "select id from public.place_order($1, 2)", [dishId]);
  const push = await until(() => sent.find((s) => s.endpoint === "https://push.example/kitchen"));
  assert.equal(push.payload.type, "order_new");
  assert.equal(push.payload.title, "Comandă nouă de la Emil");
  assert.equal(push.payload.body, "Sarmale cu mămăligă × 2");
  assert.equal(push.payload.url, "/admin");
  assert.equal(push.payload.tag, `order-${order!.id}`);
  assert.equal(push.options.urgency, "high");
});

test("accept / reject reach the client in Romanian; an expired browser is forgotten", async () => {
  sent.length = 0;
  await subscribe("client", "https://push.example/emil");
  await subscribe("client", GONE);
  const order = await as<{ id: string }>("client", "select id from public.place_order($1, 1)", [dishId]);
  await as("admin", "select public.accept_order($1, 25)", [order!.id]);

  const accepted = await until(() =>
    sent.find((s) => s.endpoint === "https://push.example/emil" && s.payload.type === "order_accepted"),
  );
  assert.equal(accepted.payload.title, "Comanda ta a fost acceptată");
  assert.equal(accepted.payload.body, "Sarmale cu mămăligă e gata în aproximativ 25 min.");
  assert.equal(accepted.payload.url, `/orders/${order!.id}`);
  assert.equal(accepted.payload.lang, "ro");

  await until(() => sent.some((s) => s.endpoint === GONE));
  let stillThere = true;
  for (let i = 0; i < 100 && stillThere; i++) {
    stillThere = !!(await row(db, "select 1 from public.push_subscriptions where endpoint = $1", [GONE]));
    if (stillThere) await new Promise((r) => setTimeout(r, 20));
  }
  assert.equal(stillThere, false, "the 410 subscription is removed");
  assert.ok(await row(db, "select 1 from public.push_subscriptions where endpoint = 'https://push.example/emil'"));
  const pushed = await row<{ pushed_at: string | null }>(
    db,
    "select pushed_at from public.notifications where order_id = $1 and type = 'order_accepted'",
    [order!.id],
  );
  assert.ok(pushed?.pushed_at, "notification is marked as pushed");

  const second = await as<{ id: string }>("client", "select id from public.place_order($1, 1)", [dishId]);
  await as("admin", "select public.reject_order($1, $2)", [second!.id, "Nu mai am varză"]);
  const rejected = await until(() => sent.find((s) => s.payload.type === "order_rejected"));
  assert.equal(rejected.payload.body, "Sarmale cu mămăligă: Nu mai am varză");
});

test("the text follows the recipient's language", async () => {
  sent.length = 0;
  await db.query("update public.profiles set locale = 'en' where id = $1", [ids.client]);
  await as("client", "select public.send_test_notification()");
  const push = await until(() => sent.find((s) => s.payload.type === "test"));
  assert.equal(push.payload.title, "Notifications work!");
  assert.equal(push.payload.lang, "en");
  assert.equal(push.options.urgency, "normal");
});

test("people without a subscribed browser get no push (the in-app banner still shows)", async () => {
  sent.length = 0;
  await db.query("delete from public.push_subscriptions");
  await as("client", "select public.send_test_notification()");
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(sent.length, 0);
});

test("renderPush fills in the time in the kitchen's time zone", () => {
  const text = renderPush("ro", {
    type: "order_extended",
    payload: { dish: "Ciorbă", minutes: 10, etaAt: "2026-10-08T09:40:00Z" },
  });
  assert.deepEqual(text, { title: "Mai durează puțin", body: "Ciorbă: încă 10 min, gata pe la 12:40." });
  assert.equal(renderPush("ro", { type: "order_rejected", payload: { dish: "Ciorbă" } })?.body, "Ciorbă nu poate fi pregătit acum.");
});
