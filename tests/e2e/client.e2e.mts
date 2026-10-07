// Stage 3 (client) end-to-end checks: menu home (wheel + list), dish page and
// ordering, live order status, cancel, history. Run with `npm run dev:local`.

import { BASE, SHOTS, account, api, browser, check, context, done, login, noHorizontalOverflow } from "./helpers.mjs";

const b = await browser();
const adminApi = await api(account("admin"));
const clientAcc = account("client");

// --- setup: clean board; Sarmale + Ciorbă on the menu, Mici off -------------------
const { data: leftovers } = await adminApi
  .from("orders")
  .select("id")
  .in("status", ["received", "accepted", "cooking", "ready"]);
for (const o of leftovers ?? []) await adminApi.rpc("reject_order", { p_order_id: o.id, p_reason: null });
const { data: dishes } = await adminApi.from("dishes").select("id, name").is("archived_at", null);
const byName = (prefix: string) => dishes!.find((d) => d.name.startsWith(prefix))!;
const sarmale = byName("Sarmale");
const ciorba = byName("Ciorbă");
const mici = byName("Mici");
await adminApi.rpc("clear_today_menu");
for (const d of [sarmale, ciorba])
  await adminApi.rpc("set_dish_available_today", { p_dish_id: d.id, p_available: true });

console.log("\n== menu home");
const phone = await context(b, "phone");
const page = await login(phone, clientAcc);
check("client lands on /", new URL(page.url()).pathname === "/");
await page.getByRole("listbox", { name: "Meniul de azi" }).waitFor();
check("wheel is the default view", true);
check("phone: home fits", await noHorizontalOverflow(page));
await page.screenshot({ path: `${SHOTS}/client-home-wheel-phone.png` });

// Turn the wheel with the keyboard: the front dish's title appears.
await page.getByRole("listbox", { name: "Meniul de azi" }).focus();
await page.keyboard.press("ArrowDown");
await page.waitForTimeout(900);
check(
  "arrow key turns the wheel to the first dish",
  (await page.getByRole("option", { selected: true }).count()) === 1,
);
await page.screenshot({ path: `${SHOTS}/client-home-wheel-turned-phone.png` });

await page.getByRole("radio", { name: "Listă" }).click();
await page.getByRole("link", { name: `Comandă ${sarmale.name}` }).waitFor();
check("list view shows today's dishes", (await page.getByRole("link", { name: /^Comandă / }).count()) === 2);
check("dish off the menu is hidden", (await page.getByText(mici.name).count()) === 0);
await page.screenshot({ path: `${SHOTS}/client-home-list-phone.png`, fullPage: true });
await page.getByRole("searchbox", { name: "Caută" }).fill("ciorb");
await page.waitForTimeout(300);
check("search filters (accent-insensitive)", (await page.getByRole("link", { name: /^Comandă / }).count()) === 1);
await page.getByRole("searchbox", { name: "Caută" }).fill("");

// The admin adds a dish: it appears without reloading.
await adminApi.rpc("set_dish_available_today", { p_dish_id: mici.id, p_available: true });
await page.getByRole("link", { name: `Comandă ${mici.name}` }).waitFor({ timeout: 10_000 });
check("menu updates live when the kitchen adds a dish", true);
await adminApi.rpc("set_dish_available_today", { p_dish_id: mici.id, p_available: false });

console.log("\n== dish page + order");
// Flip a card to its ingredients and back (3D flip on lite/full).
await page.getByRole("button", { name: `Vezi ingredientele pentru ${sarmale.name}` }).click();
await page.getByRole("button", { name: `Înapoi la poza pentru ${sarmale.name}` }).waitFor();
check(
  "card flips to its ingredients",
  await page.getByRole("button", { name: `Înapoi la poza pentru ${sarmale.name}` }).isVisible(),
);
await page.waitForTimeout(500);
await page.screenshot({ path: `${SHOTS}/client-card-flipped-phone.png` });
await page.getByRole("button", { name: `Înapoi la poza pentru ${sarmale.name}` }).click();
await page.waitForTimeout(500);

// Opening a dish from the menu: an overlay over the menu (shared photo element).
await page.getByRole("link", { name: `Comandă ${sarmale.name}` }).click();
await page.waitForURL(`${BASE}/dish/${sarmale.id}`);
const dish = page.getByRole("dialog");
await dish.getByRole("heading", { level: 1, name: sarmale.name }).waitFor();
// The menu stays mounted underneath (hidden from assistive tech while the dialog is open).
check(
  "dish opens as an overlay over the menu",
  (await page.locator('[role="radiogroup"][aria-label="Mod de afișare"]').count()) === 1,
);
check("dish page shows ingredients", await dish.getByText("Carne tocată de porc").isVisible());
check("phone: dish page fits", await noHorizontalOverflow(page));
await page.screenshot({ path: `${SHOTS}/client-dish-phone.png` });
await dish.getByRole("button", { name: "O porție în plus" }).click();
check("quantity stepper", (await dish.locator("output").textContent())?.includes("2 porții"));
await dish.getByRole("radio", { name: "La o anumită oră" }).click();
check("time picker appears", await dish.locator('input[type="time"]').isVisible());
await dish.getByRole("radio", { name: "Cât mai repede" }).click();
await dish.getByLabel("Mențiuni (opțional)").fill("Mai multă smântână, vă rog");
await dish.getByRole("button", { name: "Trimite comanda" }).click();
await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/, { timeout: 15_000 });
const orderId = page.url().split("/").pop()!;
await page.getByRole("dialog").waitFor({ state: "detached", timeout: 10_000 });
check("overlay closes when the order is placed", true);
await page.getByRole("heading", { name: "Am primit comanda. Așteaptă confirmarea bucătarului." }).waitFor();
check("order sent, status screen shows 'received'", true);
check("comment shown on the status screen", await page.getByText("Mai multă smântână, vă rog").isVisible());
await page.screenshot({ path: `${SHOTS}/client-order-received-phone.png`, fullPage: true });

console.log("\n== live status");
await adminApi.rpc("accept_order", { p_order_id: orderId, p_minutes: 20 });
await page.getByRole("status").filter({ hasText: "Comanda ta a fost acceptată" }).waitFor({ timeout: 10_000 });
check("banner: accepted", true);
await page.getByRole("heading", { name: /acceptată/ }).waitFor();
const timerText = await page.getByRole("timer").textContent();
check(`live timer ring (${timerText})`, /^(19|20):\d\d$/.test(timerText ?? ""));
await adminApi.rpc("extend_order_timer", { p_order_id: orderId, p_minutes: 10 });
await page.getByRole("status").filter({ hasText: "Mai durează puțin" }).waitFor({ timeout: 10_000 });
check("banner: timer extended", true);
await page.waitForTimeout(1200);
check("timer jumped by 10 min", /^(29|30):\d\d$/.test((await page.getByRole("timer").textContent()) ?? ""));
await adminApi.rpc("start_cooking", { p_order_id: orderId });
await page.getByRole("heading", { name: "Se gătește acum." }).waitFor({ timeout: 10_000 });
check("cooking: cancel button is gone", (await page.getByRole("button", { name: "Anulează comanda" }).count()) === 0);
await page.screenshot({ path: `${SHOTS}/client-order-cooking-phone.png`, fullPage: true });
await adminApi.rpc("mark_order_ready", { p_order_id: orderId });
await page.getByRole("status").filter({ hasText: "Mâncarea e gata!" }).waitFor({ timeout: 10_000 });
check("banner: ready", true);
await page.getByRole("heading", { name: "E gata! Vino să o iei." }).waitFor();
check(
  "timeline lists every step",
  (await page.locator("ol li", { hasText: /Acceptată de|Pusă pe foc|Timp prelungit|Gata!/ }).count()) >= 4,
);
await page.screenshot({ path: `${SHOTS}/client-order-ready-phone.png`, fullPage: true });
await adminApi.rpc("hand_over_order", { p_order_id: orderId });

console.log("\n== my orders + cancel");
const { data: o2 } = await (await api(clientAcc)).rpc("place_order", { p_dish_id: ciorba.id, p_quantity: 1 });
await page.goto(`${BASE}/orders`);
const card = page.locator("article", { hasText: `#${o2!.number}` });
await card.waitFor();
check("active order listed", true);
check(
  "history lists the handed-over order",
  (await page.locator("#history-title ~ ul a", { hasText: sarmale.name }).count()) >= 1,
);
check("phone: orders page fits", await noHorizontalOverflow(page));
await page.screenshot({ path: `${SHOTS}/client-orders-phone.png`, fullPage: true });
await card.getByRole("button", { name: "Anulează comanda" }).click();
await page.getByRole("alertdialog").getByRole("button", { name: "Da, anulează" }).click();
await page.getByText("Comanda a fost anulată.").waitFor();
check("client cancels while 'received'", true);
const { data: staffNotif } = await adminApi.from("notifications").select("type").eq("order_id", o2!.id);
check(
  "kitchen got the cancellation",
  (staffNotif ?? []).some((n) => n.type === "order_cancelled"),
);
await phone.close();

console.log("\n== animation tiers");
{
  const ctx = await context(b, "desktop");
  const p = await login(ctx, clientAcc);
  await p.goto(`${BASE}/settings`);
  await p.getByRole("radio", { name: "Reduse" }).click();
  await p.getByText("Preferința a fost salvată.").waitFor();
  check("tier attribute = reduced", (await p.evaluate(() => document.documentElement.dataset.tier)) === "reduced");
  await p.goto(`${BASE}/`);
  await p.getByRole("link", { name: `Comandă ${sarmale.name}` }).waitFor();
  check("reduced: list view, no 3D wheel", (await p.getByRole("listbox", { name: "Meniul de azi" }).count()) === 0);
  await p.goto(`${BASE}/settings`);
  await p.getByRole("radio", { name: "Auto" }).click();
  await p.getByText("Preferința a fost salvată.").waitFor();
  const detected = await p.evaluate(() => document.documentElement.dataset.tier);
  check(`auto: headless Chromium (software GL) is detected as lite (${detected})`, detected === "lite");
  await ctx.close();
}

console.log("\n== desktop + roles");
const desk = await context(b, "desktop");
const dp = await login(desk, clientAcc);
await dp.getByRole("radio", { name: "Roată" }).click();
await dp.getByRole("listbox", { name: "Meniul de azi" }).waitFor();
await dp.mouse.move(720, 600);
await dp.mouse.wheel(0, 900);
await dp.waitForTimeout(1200);
check("mouse wheel turns the drum", (await dp.getByRole("option", { selected: true }).count()) === 1);
await dp.screenshot({ path: `${SHOTS}/client-home-wheel-desktop.png` });
await dp.getByRole("radio", { name: "Listă" }).click();
await dp.screenshot({ path: `${SHOTS}/client-home-list-desktop.png` });
await dp.goto(`${BASE}/dish/${sarmale.id}`);
await dp.screenshot({ path: `${SHOTS}/client-dish-desktop.png` });
await dp.goto(`${BASE}/orders/${orderId}`);
await dp.screenshot({ path: `${SHOTS}/client-order-desktop.png` });
await dp.goto(`${BASE}/dish/${mici.id}`);
await dp.getByRole("heading", { name: "Pagina nu există" }).waitFor({ timeout: 10_000 });
check("client can't open a dish that's off the menu (404)", true);
await desk.close();

const owner = await context(b, "desktop");
const op = await login(owner, account("owner"));
await op.goto(`${BASE}/dish/${mici.id}`);
await op.getByText("nu e în meniul de azi").waitFor({ timeout: 10_000 });
check(
  "owner sees off-menu dish with ordering disabled",
  await op.getByRole("button", { name: "Trimite comanda" }).isDisabled(),
);
await owner.close();
const adminCtx = await context(b, "desktop");
const ap = await login(adminCtx, account("admin"));
await ap.goto(`${BASE}/dish/${sarmale.id}`);
check("admin role is redirected away from client pages", new URL(ap.url()).pathname === "/admin");
await adminCtx.close();

await b.close();
done("client e2e");
