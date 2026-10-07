// Notifications end-to-end checks: the service worker's subscription route,
// the service worker showing pushes, and the opt-in UI. Run with `npm run dev`
// in another terminal (see helpers.mts). What the server sends for each event
// is covered by tests/push.test.ts.

import { BASE, SHOTS, account, browser, check, context, done, login, temporaryAccount } from "./helpers.mjs";

const b = await browser({ full: true });
const clientAcc = account("client");

console.log("\n== subscription route (used by the service worker when the browser rotates keys)");
{
  // A throwaway account: deleting it also deletes the made-up subscription below.
  const temp = await temporaryAccount(b);
  const ctx = await context(b, "desktop");
  const page = await login(ctx, temp.account);
  const post = (body: unknown) =>
    page.evaluate(
      (payload) =>
        fetch("/api/push/subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then(async (r) => ({ status: r.status, body: await r.json() })),
      body,
    );
  const endpoint = `https://push.invalid/e2e-${Date.now().toString(36)}`;
  const keys = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" };
  const ok = await post({ subscription: { endpoint, keys }, userAgent: "e2e" });
  check("signed in: subscription saved", ok.status === 200 && ok.body.ok === true, ok);
  const bad = await post({ subscription: { endpoint: "http://not-https.example/x", keys } });
  check("non-https endpoint refused", bad.status === 400 && bad.body.error === "invalid_subscription", bad);
  const missing = await post({ subscription: { endpoint } });
  check("missing keys refused", missing.status === 400, missing);
  const anonymous = await fetch(`${BASE}/api/push/subscription`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: { endpoint, keys } }),
  });
  check("signed out: 401", anonymous.status === 401);
  await ctx.close();
  await temp.remove();
}

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
