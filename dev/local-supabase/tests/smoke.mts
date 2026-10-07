// Smoke test for the emulator with the real supabase-js client.
//   npm run emulator   (in another terminal)   then   npx tsx dev/local-supabase/tests/smoke.mts
import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

import type { Database } from "../../../lib/supabase/database.types";
import { PUBLISHABLE_KEY } from "../jwt";

const URL = "http://127.0.0.1:54321";
const users = JSON.parse(fs.readFileSync("scripts/users.local.json", "utf8")).users as {
  username: string;
  password: string;
  role: string;
}[];
const client = () =>
  createClient<Database>(URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
  });
let failures = 0;
const check = (label: string, ok: boolean, extra?: unknown) => {
  console.log(ok ? "  ok  " : "  FAIL", label, ok ? "" : JSON.stringify(extra));
  if (!ok) failures++;
};
async function signIn(role: string) {
  const u = users.find((x) => x.role === role)!;
  const c = client();
  const { error } = await c.auth.signInWithPassword({
    email: `${u.username.toLowerCase()}@meniu.local`,
    password: u.password,
  });
  if (error) throw error;
  return c;
}

const admin = await signIn("admin");
const emil = await signIn("client");

const { data: menu, error: menuErr } = await emil
  .from("dishes")
  .select("id, name, dish_ingredients(name, quantity, unit, position)")
  .order("name")
  .order("position", { referencedTable: "dish_ingredients" });
check("client sees today's 4 dishes", !menuErr && menu?.length === 4, { menuErr, n: menu?.length });
check(
  "embedded ingredients ordered",
  (menu?.[0]?.dish_ingredients ?? []).every((x, i, a) => i === 0 || a[i - 1].position <= x.position),
);
const { data: all } = await admin.from("dishes").select("id, name, available_on").order("name");
check("admin sees all 6 dishes", all?.length === 6, all?.length);
const { data: me } = await emil.from("profiles").select("*").eq("username", "Emil").maybeSingle();
check("maybeSingle profile", me?.role === "client", me);
const { error: roleErr } = await emil.from("profiles").update({ role: "owner" }).eq("id", me!.id);
check("client cannot change role (column grant)", !!roleErr, roleErr);

// realtime: admin listens to orders + notifications
const events: string[] = [];
await new Promise<void>((resolve, reject) => {
  admin
    .channel("admin-orders")
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (p) =>
      events.push(`orders:${p.eventType}:${(p.new as { status?: string }).status ?? ""}`),
    )
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (p) =>
      events.push(`notif:${(p.new as { type: string }).type}`),
    )
    .subscribe((status, err) =>
      status === "SUBSCRIBED" ? resolve() : status === "CHANNEL_ERROR" ? reject(err) : undefined,
    );
});
const sarmale = menu!.find((d) => d.name.startsWith("Sarmale"))!;
const { data: order, error: orderErr } = await emil.rpc("place_order", {
  p_dish_id: sarmale.id,
  p_quantity: 2,
  p_comment: "Fără smântână",
});
check("place_order via rpc", !orderErr && order?.status === "received", orderErr);
const { error: forbidden } = await emil.rpc("accept_order", { p_order_id: order!.id, p_minutes: 20 });
check("client accept_order -> forbidden", forbidden?.message === "forbidden", forbidden);
const { data: accepted } = await admin.rpc("accept_order", { p_order_id: order!.id, p_minutes: 20 });
check("admin accepts", accepted?.status === "accepted" && !!accepted?.eta_at, accepted);
await new Promise((r) => setTimeout(r, 600));
check(
  "admin realtime got INSERT + UPDATE + notification",
  events.includes("orders:INSERT:received") &&
    events.includes("orders:UPDATE:accepted") &&
    events.includes("notif:order_new"),
  events,
);

const { data: embed } = await admin
  .from("orders")
  .select("id, number, client:profiles!orders_client_id_fkey(display_name), dish:dishes(name)")
  .eq("id", order!.id)
  .single();
check(
  "many-to-one embed with fk hint + single()",
  (embed as unknown as { client: { display_name: string } })?.client?.display_name === "Emil",
  embed,
);
const { count } = await admin
  .from("orders")
  .select("*", { count: "exact", head: true })
  .in("status", ["received", "accepted"]);
check("count exact + in()", count === 1, count);

// storage
const png = Buffer.from("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA", "base64");
const { error: upErrClient } = await emil.storage
  .from("dish-photos")
  .upload("test/x.webp", new Blob([png], { type: "image/webp" }));
check("client upload blocked by storage RLS", !!upErrClient, upErrClient);
const { data: up, error: upErr } = await admin.storage
  .from("dish-photos")
  .upload("test/x.webp", new Blob([png], { type: "image/webp" }), { upsert: true });
check("admin upload", !upErr && up?.path === "test/x.webp", upErr);
const res = await fetch(`${URL}/storage/v1/object/public/dish-photos/test/x.webp`);
check("public download", res.ok && res.headers.get("content-type") === "image/webp", res.status);
const { data: removed } = await admin.storage.from("dish-photos").remove(["test/x.webp"]);
check("remove", removed?.length === 1, removed);

await emil.rpc("cancel_order", { p_order_id: order!.id });
await admin.removeAllChannels();
console.log(failures ? `\n${failures} FAILURE(S)` : "\nEMULATOR SMOKE TEST PASSED");
process.exit(failures ? 1 : 0);
