// Stage 4 (notifications) end-to-end checks. Run with `npm run dev:local`.
// Subscriptions on the reserved ".invalid" TLD are not contacted by the local
// send-push function; what it would send is appended to push-log.jsonl.

import fs from "node:fs";
import path from "node:path";

import { BASE, SHOTS, account, api, browser, check, context, done, login } from "./helpers.mjs";

const LOG = path.join(process.cwd(), "dev/local-supabase/.data/push-log.jsonl");
const readLog = () =>
  fs.existsSync(LOG)
    ? fs
        .readFileSync(LOG, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map(
          (l) =>
            JSON.parse(l) as {
              endpoint: string;
              payload: { title: string; body: string; url: string; type: string; lang: string };
            },
        )
    : [];
const waitFor = async <T,>(fn: () => T | undefined | null | false, ms = 8000): Promise<T | null> => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 150));
  }
  return null;
};

const b = await browser({ full: true });
const adminApi = await api(account("admin"));
const clientAcc = account("client");
const clientApi = await api(clientAcc);
const run = Date.now().toString(36);
fs.rmSync(LOG, { force: true });

const { data: dishes } = await adminApi.from("dishes").select("id, name").is("archived_at", null);
const sarmale = dishes!.find((d) => d.name.startsWith("Sarmale"))!;
await adminApi.rpc("set_dish_available_today", { p_dish_id: sarmale.id, p_available: true });

console.log("\n== DB trigger -> Edge Function -> Web Push");
const live = `https://fcm.invalid/${run}/emil`;
const gone = `https://fcm.invalid/${run}/gone`;
for (const endpoint of [live, gone]) {
  const { error } = await clientApi.rpc("register_push_subscription", {
    p_endpoint: endpoint,
    p_p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
    p_auth: "tBHItJI5svbpez7KI4CCXg",
    p_user_agent: "e2e",
  });
  check(`register subscription ${endpoint.split("/").pop()}`, !error, error);
}
const { data: order } = await clientApi.rpc("place_order", { p_dish_id: sarmale.id, p_quantity: 1 });
await adminApi.rpc("accept_order", { p_order_id: order!.id, p_minutes: 25 });
const accepted = await waitFor(() => readLog().find((l) => l.endpoint === live && l.payload.type === "order_accepted"));
check("accepted -> push sent to the client's browser", !!accepted);
check(
  `push text is Romanian ("${accepted?.payload.title}" / "${accepted?.payload.body}")`,
  accepted?.payload.title === "Comanda ta a fost acceptată" &&
    accepted.payload.body.includes("Sarmale cu mămăligă") &&
    accepted.payload.body.includes("25 min"),
);
check("push opens the order page", accepted?.payload.url === `/orders/${order!.id}`);
await waitFor(async () => false, 600);
const { data: subs } = await clientApi.from("push_subscriptions").select("endpoint");
check(
  "expired subscription (410) was removed",
  !(subs ?? []).some((s) => s.endpoint === gone) && (subs ?? []).some((s) => s.endpoint === live),
  subs,
);
const { data: notif } = await clientApi
  .from("notifications")
  .select("pushed_at")
  .eq("order_id", order!.id)
  .eq("type", "order_accepted")
  .single();
check("notification marked as pushed", !!notif?.pushed_at);

await adminApi.rpc("reject_order", { p_order_id: order!.id, p_reason: "Nu mai am varză" });
const rejected = await waitFor(() => readLog().find((l) => l.endpoint === live && l.payload.type === "order_rejected"));
check(
  "rejection push carries the reason",
  rejected?.payload.body === "Sarmale cu mămăligă: Nu mai am varză",
  rejected?.payload,
);

// Staff side: a new order pushes to the owner and the admin.
const staffEndpoint = `https://fcm.invalid/${run}/admin`;
await adminApi.rpc("register_push_subscription", {
  p_endpoint: staffEndpoint,
  p_p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
  p_auth: "tBHItJI5svbpez7KI4CCXg",
});
const { data: o2 } = await clientApi.rpc("place_order", { p_dish_id: sarmale.id, p_quantity: 2 });
const newOrder = await waitFor(() =>
  readLog().find((l) => l.endpoint === staffEndpoint && l.payload.type === "order_new"),
);
check(
  `new order -> push to the kitchen ("${newOrder?.payload.title}")`,
  newOrder?.payload.title.startsWith("Comandă nouă de la") && newOrder.payload.body === "Sarmale cu mămăligă × 2",
);
await clientApi.rpc("cancel_order", { p_order_id: o2!.id });
const cancelled = await waitFor(() =>
  readLog().find((l) => l.endpoint === staffEndpoint && l.payload.type === "order_cancelled"),
);
check("cancellation -> push to the kitchen", !!cancelled);

// Language follows the recipient's profile.
const me = (await clientApi.auth.getUser()).data.user!.id;
await clientApi.from("profiles").update({ locale: "en" }).eq("id", me);
await clientApi.rpc("send_test_notification");
const test = await waitFor(() => readLog().find((l) => l.endpoint === live && l.payload.type === "test"));
check(
  `English recipient gets English text ("${test?.payload.title}")`,
  test?.payload.title === "Notifications work!" && test.payload.lang === "en",
);
await clientApi.from("profiles").update({ locale: "ro" }).eq("id", me);
for (const e of [live, staffEndpoint]) await adminApi.from("push_subscriptions").delete().eq("endpoint", e);

console.log("\n== service worker shows pushes");
{
  const ctx = await context(b, "desktop");
  await ctx.grantPermissions(["notifications"], { origin: BASE });
  const page = await login(ctx, clientAcc);
  await page.waitForFunction(() => navigator.serviceWorker.getRegistration("/").then((r) => !!r?.active), null, {
    timeout: 15_000,
  });
  check("service worker registered and active", true);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("ServiceWorker.enable");
  const registrationId = await new Promise<string>((resolve) => {
    cdp.on(
      "ServiceWorker.workerRegistrationUpdated",
      (e: { registrations: { registrationId: string; scopeURL: string }[] }) => {
        const reg = e.registrations.find((r) => r.scopeURL.startsWith(BASE));
        if (reg) resolve(reg.registrationId);
      },
    );
  });
  const payload = {
    title: "Mâncarea e gata!",
    body: "Sarmale cu mămăligă te așteaptă. Poftă bună!",
    url: "/orders",
    tag: "order-e2e",
    type: "order_ready",
  };

  // App in front: the in-app banner covers it, no system notification.
  await cdp.send("ServiceWorker.deliverPushMessage", { origin: BASE, registrationId, data: JSON.stringify(payload) });
  await page.waitForTimeout(800);
  const whileOpen = await page.evaluate(() =>
    navigator.serviceWorker.ready.then((r) => r.getNotifications().then((n) => n.length)),
  );
  check("app focused -> no duplicate system notification", whileOpen === 0);

  // App in the background (another site in the tab): system notification.
  await page.goto("about:blank");
  await cdp.send("ServiceWorker.deliverPushMessage", { origin: BASE, registrationId, data: JSON.stringify(payload) });
  await page.waitForTimeout(800);
  await page.goto(`${BASE}/settings`);
  const shown = await page.evaluate(() =>
    navigator.serviceWorker.ready.then((r) =>
      r
        .getNotifications()
        .then((list) => list.map((n) => ({ title: n.title, body: n.body, tag: n.tag, url: n.data?.url }))),
    ),
  );
  check(
    "app closed -> system notification with the push text",
    shown.length === 1 && shown[0].title === "Mâncarea e gata!" && shown[0].url === "/orders",
    shown,
  );
  await ctx.close();
}

console.log("\n== opt-in UI");
{
  // Permission never requested automatically.
  const ctx = await context(b, "phone");
  const page = await login(ctx, clientAcc);
  let asked = false;
  await page.exposeFunction("__permissionAsked", () => (asked = true));
  await page.addInitScript(`
    (() => {
      const original = Notification.requestPermission.bind(Notification);
      Notification.requestPermission = (...args) => { window.__permissionAsked(); return original(...args); };
    })();
  `);
  await page.goto(`${BASE}/orders`);
  await page.getByText("Vrei să afli imediat când e gata?").waitFor();
  check("orders page offers notifications with a button", true);
  await page.waitForTimeout(1500);
  check("permission was not requested automatically", !asked);
  await page.screenshot({ path: `${SHOTS}/push-prompt-phone.png` });
  await page.goto(`${BASE}/settings`);
  await page.getByRole("button", { name: "Activează notificările" }).waitFor();
  check("settings has the explicit button", true);
  await ctx.close();

  // Denied: clear instructions.
  const denied = await context(b, "desktop");
  // Simulate a browser where the user blocked notifications for this site.
  // (A string, not a function: tsx would inject helpers that don't exist in the page.)
  await denied.addInitScript(`
    (() => {
      const Real = window.Notification;
      function Blocked(...args) { return new Real(...args); }
      Object.defineProperty(Blocked, "permission", { get: () => "denied" });
      Blocked.requestPermission = async () => "denied";
      Object.defineProperty(window, "Notification", { value: Blocked, configurable: true, writable: true });
    })();
  `);
  const dp = await login(denied, clientAcc);
  await dp.goto(`${BASE}/settings`);
  await dp.getByText("Notificările sunt blocate pentru acest site").waitFor();
  check("denied -> how to re-enable it", await dp.getByText(/Chrome \/ Edge pe calculator/).isVisible());
  check("denied -> in-app fallback is explained", await dp.getByText(/vei vedea anunțurile în pagină/).isVisible());
  await dp.screenshot({ path: `${SHOTS}/push-denied-desktop.png` });
  await denied.close();

  // Granted: the button subscribes (headless Chromium has no push service, so
  // a graceful error toast is also acceptable here).
  const granted = await context(b, "desktop");
  await granted.grantPermissions(["notifications"], { origin: BASE });
  const gp = await login(granted, clientAcc);
  await gp.goto(`${BASE}/settings`);
  await gp.getByRole("button", { name: "Activează notificările" }).click();
  const outcome = await Promise.race([
    gp
      .getByText("Notificările sunt active pe acest dispozitiv.")
      .waitFor({ timeout: 15_000 })
      .then(() => "enabled"),
    gp
      .getByText("Notificările nu au putut fi activate")
      .waitFor({ timeout: 15_000 })
      .then(() => "error"),
  ]).catch(() => "nothing");
  check(`enable button ends in a clear state (${outcome})`, outcome !== "nothing");
  await granted.close();
}

await b.close();
done("push e2e");
