// Client end-to-end checks: menu home (wheel + list), dish page and ordering,
// live order status, cancel, history. Run with `npm run dev` in another
// terminal (see helpers.mts).

import {
  BASE,
  SHOTS,
  account,
  browser,
  check,
  clearBoard,
  clearMenu,
  context,
  done,
  hydrated,
  login,
  noHorizontalOverflow,
  onBoard,
  orderNo,
  placeOrder,
  recordNotifications,
  sampleDishes,
  setOnMenu,
  temporaryAccount,
  until,
} from "./helpers.mjs";

const b = await browser();
const clientAcc = account("client");

// --- setup: the kitchen's browser; clean board; Sarmale + Ciorbă on the menu, Mici off
const kitchenCtx = await context(b, "desktop");
const kitchenNotifications = await recordNotifications(kitchenCtx);
const kitchen = await login(kitchenCtx, account("admin"));
await clearBoard(kitchen);
const { sarmale, ciorba, mici } = await sampleDishes(kitchen);
await clearMenu(kitchen);
for (const d of [sarmale, ciorba]) await setOnMenu(kitchen, d.name, true);

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
await setOnMenu(kitchen, mici.name, true);
await page.getByRole("link", { name: `Comandă ${mici.name}` }).waitFor({ timeout: 10_000 });
check("menu updates live when the kitchen adds a dish", true);
await setOnMenu(kitchen, mici.name, false);
await page.getByRole("link", { name: `Comandă ${mici.name}` }).waitFor({ state: "detached", timeout: 10_000 });
check("... and when it takes one off", true);

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
await hydrated(page, "[role=dialog] textarea");
await dish.getByRole("button", { name: "O porție în plus" }).click();
check("quantity stepper", (await dish.locator("output").textContent())?.includes("2 porții"));
await dish.getByRole("radio", { name: "La o anumită oră" }).click();
check("time picker appears", await dish.locator('input[type="time"]').isVisible());
await dish.getByRole("radio", { name: "Cât mai repede" }).click();
await dish.getByLabel("Mențiuni (opțional)").fill("Mai multă smântână, vă rog");
await dish.getByRole("button", { name: "Trimite comanda" }).click();
await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/, { timeout: 15_000 });
const orderId = page.url().split("/").pop()!;
const orderNumber = Number((await page.getByText(/Comanda #\d+/).first().textContent())!.match(/#(\d+)/)![1]);
await page.getByRole("dialog").waitFor({ state: "detached", timeout: 10_000 });
check("overlay closes when the order is placed", true);
await page.getByRole("heading", { name: "Am primit comanda. Așteaptă confirmarea bucătarului." }).waitFor();
check("order sent, status screen shows 'received'", true);
check("comment shown on the status screen", await page.getByText("Mai multă smântână, vă rog").isVisible());
await page.screenshot({ path: `${SHOTS}/client-order-received-phone.png`, fullPage: true });

console.log("\n== live status");
await onBoard(kitchen, orderNumber, { do: "accept", minutes: 20 });
await page.getByRole("status").filter({ hasText: "Comanda ta a fost acceptată" }).waitFor({ timeout: 10_000 });
check("banner: accepted", true);
await page.getByRole("heading", { name: /acceptată/ }).waitFor();
const timerText = await page.getByRole("timer").textContent();
check(`live timer ring (${timerText})`, /^(19|20):\d\d$/.test(timerText ?? ""));
await onBoard(kitchen, orderNumber, { do: "extend", minutes: 10 });
await page.getByRole("status").filter({ hasText: "Mai durează puțin" }).waitFor({ timeout: 10_000 });
check("banner: timer extended", true);
await page.waitForTimeout(1200);
check("timer jumped by 10 min", /^(29|30):\d\d$/.test((await page.getByRole("timer").textContent()) ?? ""));
await onBoard(kitchen, orderNumber, { do: "cook" });
await page.getByRole("heading", { name: "Se gătește acum." }).waitFor({ timeout: 10_000 });
check("cooking: cancel button is gone", (await page.getByRole("button", { name: "Anulează comanda" }).count()) === 0);
await page.screenshot({ path: `${SHOTS}/client-order-cooking-phone.png`, fullPage: true });
await onBoard(kitchen, orderNumber, { do: "ready" });
await page.getByRole("status").filter({ hasText: "Mâncarea e gata!" }).waitFor({ timeout: 10_000 });
check("banner: ready", true);
await page.getByRole("heading", { name: "E gata! Vino să o iei." }).waitFor();
check(
  "timeline lists every step",
  (await page.locator("ol li", { hasText: /Acceptată de|Pusă pe foc|Timp prelungit|Gata!/ }).count()) >= 4,
);
await page.screenshot({ path: `${SHOTS}/client-order-ready-phone.png`, fullPage: true });
await onBoard(kitchen, orderNumber, { do: "handOver" });

console.log("\n== my orders + cancel");
const o2 = await placeOrder(page, ciorba.id);
await page.goto(`${BASE}/orders`);
const card = page.locator("article", { hasText: orderNo(o2.number) });
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
check(
  "kitchen got the cancellation",
  await until(() => kitchenNotifications.some((n) => n.type === "order_cancelled" && n.order_id === o2.id)),
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

console.log("\n== account: change password + sign out");
{
  const temp = await temporaryAccount(b);
  const phoneCtx = await context(b, "phone");
  const p = await login(phoneCtx, temp.account);
  const otherCtx = await context(b, "desktop"); // a second device, signed in too
  const other = await login(otherCtx, temp.account);

  await p.goto(`${BASE}/settings`);
  await hydrated(p, "input[autocomplete='new-password']");
  const newPassword = `${temp.account.password}-new`;
  await p.getByLabel("Parola actuală").fill("not-the-password");
  await p.getByLabel("Parola nouă", { exact: true }).fill(newPassword);
  await p.getByLabel("Confirmă parola nouă").fill(newPassword);
  await p.getByRole("button", { name: "Schimbă parola" }).click();
  await p.getByText("Parola actuală nu e corectă.").waitFor();
  check("wrong current password is refused", true);
  await p.getByLabel("Parola actuală").fill(temp.account.password);
  await p.getByLabel("Parola nouă", { exact: true }).fill(newPassword);
  await p.getByLabel("Confirmă parola nouă").fill(newPassword);
  await p.getByRole("button", { name: "Schimbă parola" }).click();
  await p.getByText("Gata! Parola a fost schimbată.").waitFor();
  check("password changed", true);
  await p.goto(`${BASE}/orders`);
  check("this device stays signed in", new URL(p.url()).pathname === "/orders");
  await other.goto(`${BASE}/orders`);
  check("the other device is signed out", new URL(other.url()).pathname === "/login");

  const stolen = (await phoneCtx.cookies()).find((c) => c.name === "meniu_session")!;
  await p.getByRole("button", { name: "Contul meu" }).click();
  await p.getByRole("menuitem", { name: "Deconectare" }).click();
  await p.waitForURL(`${BASE}/login`);
  check("sign out lands on the login page", true);
  await otherCtx.addCookies([stolen]);
  await other.goto(`${BASE}/orders`);
  check("the old session cookie no longer works", new URL(other.url()).pathname === "/login");
  await otherCtx.close();
  await phoneCtx.close();
  await temp.remove();
}

await kitchenCtx.close();
await b.close();
done("client e2e");
