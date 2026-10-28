import fs from "node:fs";

import sharp from "sharp";

import {
  BASE,
  SHOTS,
  account,
  browser,
  canSignIn,
  check,
  clearBoard,
  context,
  done,
  hydrated,
  login,
  noHorizontalOverflow,
  onBoard,
  orderNo,
  placeOrder,
  cancelOrder,
  recordNotifications,
  sampleDishes,
  serverAction,
  setOnMenu,
  until,
} from "./helpers.mjs";

const SAMPLE = process.env.E2E_SAMPLE_PHOTO ?? "tests/e2e/fixtures/big-photo.jpg";
const b = await browser();
const adminAcc = account("admin");
const ownerAcc = account("owner");
const clientAcc = account("client");

const kitchenCtx = await context(b, "desktop");
const kitchen = await login(kitchenCtx, adminAcc);
await clearBoard(kitchen);
const { sarmale, ciorba } = await sampleDishes(kitchen);
await setOnMenu(kitchen, sarmale.name, true);

const clientCtx = await context(b, "desktop");
const clientNotifications = await recordNotifications(clientCtx);
const client = await login(clientCtx, clientAcc);

console.log("\n== orders board (desktop)");
{
  const ctx = await context(b, "desktop");
  const page = await login(ctx, adminAcc);
  check("admin lands on /admin", new URL(page.url()).pathname === "/admin");
  await page.getByText("În direct").waitFor({ timeout: 15_000 });
  check("live badge says live", true);

  const order = await placeOrder(client, sarmale.id, { quantity: 2, comment: "Fără smântână, vă rog" });
  const banner = page.getByRole("status").filter({ hasText: "Comandă nouă de la" });
  await banner.waitFor({ timeout: 10_000 });
  check("new order banner appears in real time", await banner.isVisible());
  await page.screenshot({ path: `${SHOTS}/admin-new-order-banner.png` });

  const card = () => page.locator("article:visible", { hasText: orderNo(order.number) });
  const column = (name: string) => page.locator("section", { has: page.locator("h2", { hasText: name }) });
  await card().waitFor();
  check("card shows comment", await card().getByText("Fără smântână, vă rog").isVisible());
  check(
    "card is in 'Noi' column",
    (await column("Noi").locator("article", { hasText: orderNo(order.number) }).count()) === 1,
  );

  await card().getByRole("button", { name: "Acceptă" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "20 min" }).click();
  await dialog.getByRole("button", { name: "Acceptă comanda" }).click();
  await column("Acceptate").locator("article", { hasText: orderNo(order.number) }).waitFor({ timeout: 10_000 });
  check("accepted card moves to 'Acceptate'", true);
  await card().getByText(/rămase/).waitFor();
  check("live timer is shown", true);
  check("decided-by is shown", await card().getByText("Acceptată de").isVisible());

  await card().getByRole("button", { name: "Prelungește cu 5 minute" }).click();
  await page.getByText("Am prelungit cu 5 min.").waitFor();
  check("extend +5 toast", true);
  await card().getByRole("button", { name: "Pune pe foc" }).click();
  await column("La foc").locator("article", { hasText: orderNo(order.number) }).waitFor({ timeout: 10_000 });
  check("start cooking moves to 'La foc'", true);
  await page.screenshot({ path: `${SHOTS}/admin-board-desktop.png` });
  await card().getByRole("button", { name: "Gata!" }).click();
  await column("Gata de predat").locator("article", { hasText: orderNo(order.number) }).waitFor({ timeout: 10_000 });
  check("ready moves to 'Gata de predat'", true);
  await card().getByRole("button", { name: "Predat" }).click();
  await page
    .locator("section", { has: page.locator("#col-done") })
    .locator("article", { hasText: orderNo(order.number) })
    .waitFor({ timeout: 10_000 });
  check("handed over goes to 'Finalizate azi'", true);

  const second = await placeOrder(client, sarmale.id);
  const secondCard = page.locator("article:visible", { hasText: orderNo(second.number) });
  await secondCard.waitFor({ timeout: 10_000 });
  await secondCard.getByRole("button", { name: "Refuză" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Nu mai am ingrediente" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Refuză comanda" }).click();
  await page.getByText(`Comanda #${second.number} a fost refuzată.`).waitFor();
  check("reject with reason", true);

  const third = await placeOrder(client, sarmale.id);
  await page.locator("article:visible", { hasText: orderNo(third.number) }).waitFor({ timeout: 10_000 });
  await cancelOrder(client, third.id);
  await page.getByRole("status").filter({ hasText: "Comandă anulată" }).waitFor({ timeout: 10_000 });
  check("cancellation banner for staff", true);

  const wanted: string[] = ["order_accepted", "order_extended", "order_ready", "order_rejected"];
  await until(() => wanted.every((t) => clientNotifications.some((n) => n.type === t)), 5000);
  const types: string[] = clientNotifications.map((n) => n.type);
  check("client got accepted/extended/ready/rejected", wanted.every((t) => types.includes(t)), types);
  check(
    "rejection reason delivered",
    clientNotifications.some(
      (n) => n.type === "order_rejected" && (n.payload as { reason?: string }).reason === "Nu mai am ingrediente",
    ),
  );
  await ctx.close();
}

console.log("\n== orders board (phone)");
{
  const o = await placeOrder(client, sarmale.id);
  const ctx = await context(b, "phone");
  const page = await login(ctx, adminAcc);
  await page.getByRole("tab", { name: /Noi/ }).click();
  await page.locator("article:visible", { hasText: orderNo(o.number) }).waitFor();
  check("phone: tabs + card visible", true);
  check("phone: no horizontal overflow", await noHorizontalOverflow(page));
  await page.screenshot({ path: `${SHOTS}/admin-board-phone.png` });
  await onBoard(kitchen, o.number, { do: "reject" });
  await ctx.close();
}

console.log("\n== dishes");
{
  if (!fs.existsSync(SAMPLE)) throw new Error(`sample photo missing: ${SAMPLE}`);
  const ctx = await context(b, "desktop");
  const page = await login(ctx, adminAcc);
  const name = `Plăcintă cu brânză E2E ${Date.now().toString(36)}`;
  await page.goto(`${BASE}/admin/dishes/new`);
  await hydrated(page, "main#content input[id$='-name']");
  await page.getByRole("button", { name: "Salvează" }).click();
  check("empty name is rejected", await page.getByText("Scrie numele preparatului.").first().isVisible());

  await page.getByLabel("Nume", { exact: true }).fill(name);
  await page.getByLabel("Descriere").fill("Plăcintă rumenită, cu brânză de vaci.");
  await page.locator('input[type="file"]').setInputFiles(SAMPLE);
  await page.getByText(/1600 × 1200 px/).waitFor({ timeout: 30_000 });
  check("photo resized to 1600px in the browser", true);
  const info = await page.getByText(/1600 × 1200 px/).textContent();
  await page.getByLabel("Timp estimat de gătit (minute)").fill("50");
  await page.getByRole("switch", { name: "Disponibil azi" }).click();
  await page.getByRole("button", { name: "Adaugă ingredient" }).click();
  await page.locator('input[id$="-name"][id*="-ing-"]').last().fill("Brânză de vaci");
  await page.locator('input[inputmode="decimal"]').last().fill("0,25");
  await page.locator("input[list]").last().fill("kg");
  await page.getByRole("button", { name: "Adaugă ingredient" }).click();
  await page.locator('input[id$="-name"][id*="-ing-"]').last().fill("Foi de plăcintă");
  await page.locator('input[inputmode="decimal"]').last().fill("2");
  await page.locator("input[list]").last().fill("buc");
  await page.screenshot({ path: `${SHOTS}/admin-dish-form-desktop.png`, fullPage: true });
  await page.getByRole("button", { name: "Salvează" }).click();
  await page.waitForURL(`${BASE}/admin/dishes`);
  check("dish saved, back on the list", true);
  await page.screenshot({ path: `${SHOTS}/admin-dishes-desktop.png` });

  await page.getByRole("link", { name: `Editează ${name}` }).click();
  await page.waitForURL(/\/admin\/dishes\/[0-9a-f-]{36}$/);
  const dishId = page.url().split("/").pop()!;
  const ingredientNames = await page.locator('input[id$="-name"][id*="-ing-"]').evaluateAll((l) =>
    l.map((i) => (i as HTMLInputElement).value),
  );
  const quantities = await page.locator('input[inputmode="decimal"]').evaluateAll((l) =>
    l.map((i) => (i as HTMLInputElement).value),
  );
  check(
    "ingredients saved with decimal comma parsed",
    /^0[,.]25$/.test(quantities[0] ?? "") && ingredientNames[1] === "Foi de plăcintă",
    { ingredientNames, quantities },
  );
  const image = page.locator(`img[alt="${name}"]`).first();
  await image.waitFor();
  const optimised = new URL((await image.getAttribute("src"))!, BASE);
  const photoUrl = new URL(optimised.searchParams.get("url") ?? optimised.pathname, BASE).toString();
  check("photo is served from this computer", photoUrl.startsWith(`${BASE}/uploads/dish-photos/`), photoUrl);
  const photoRes = await fetch(photoUrl);
  const bytes = Buffer.from(await photoRes.arrayBuffer());
  const meta: { format?: string; width?: number; height?: number } = await sharp(bytes)
    .metadata()
    .catch(() => ({}));
  check(
    `uploaded photo is small (${Math.round(bytes.length / 1024)} KB, ${meta.format} ${meta.width}x${meta.height}; UI said "${info?.trim()}")`,
    photoRes.ok && bytes.length <= 300 * 1024 * 1.25 && Math.max(meta.width ?? 9999, meta.height ?? 9999) <= 1600,
  );
  check(
    "optimised version is served (next/image)",
    (await fetch(optimised, { headers: { Accept: "image/avif,image/webp" } })).ok,
  );
  await page.reload();
  check("blur placeholder stored", /photo_blur\\*":\\*"data:image\//.test(await page.content()));

  await page.getByLabel("Timp estimat de gătit (minute)").fill("55");
  await page.getByRole("button", { name: "Salvează" }).click();
  await page.waitForURL(`${BASE}/admin/dishes`);
  await page.goto(`${BASE}/admin/dishes/${dishId}`);
  await hydrated(page, "main#content input[id$='-name']");
  const minutes = await page.getByLabel("Timp estimat de gătit (minute)").inputValue();
  const samePhoto = (await page.locator(`img[alt="${name}"]`).first().getAttribute("src")) === optimised.pathname + optimised.search;
  check("edit keeps photo, updates minutes", minutes === "55" && samePhoto, { minutes });

  await page.getByRole("button", { name: "Șterge preparatul" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Da, șterge" }).click();
  await page.waitForURL(`${BASE}/admin/dishes`);
  await page.goto(`${BASE}/admin/dishes/${dishId}`);
  const gone = await page
    .getByRole("heading", { name: "Pagina nu există" })
    .waitFor({ timeout: 10_000 })
    .then(() => true, () => false);
  const photoGone = (await fetch(photoUrl)).status === 404;
  check("never-ordered dish is deleted with its photo", gone && photoGone, { gone, photoGone });

  const phone = await context(b, "phone");
  const pp = await login(phone, adminAcc);
  await pp.goto(`${BASE}/admin/dishes`);
  check("phone: dishes list fits", await noHorizontalOverflow(pp));
  await pp.screenshot({ path: `${SHOTS}/admin-dishes-phone.png` });
  await pp.goto(`${BASE}/admin/dishes/new`);
  check("phone: dish form fits", await noHorizontalOverflow(pp));
  await pp.screenshot({ path: `${SHOTS}/admin-dish-form-phone.png`, fullPage: true });
  await phone.close();
  await ctx.close();
}

console.log("\n== today's menu");
{
  const ctx = await context(b, "phone");
  const page = await login(ctx, adminAcc);
  await page.goto(`${BASE}/admin/menu`);
  const sw = page.getByRole("switch", { name: `${ciorba.name} în meniul de azi` });
  const before = await sw.getAttribute("aria-checked");
  await serverAction(page, () => sw.click());
  await page.reload();
  const after = await page.getByRole("switch", { name: `${ciorba.name} în meniul de azi` }).getAttribute("aria-checked");
  check("toggle is saved", before !== after, { before, after });
  check("phone: menu fits", await noHorizontalOverflow(page));
  await page.screenshot({ path: `${SHOTS}/admin-menu-phone.png`, fullPage: true });
  await page.getByRole("button", { name: "Golește meniul" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Golește meniul" }).click();
  await page.getByText("Meniul de azi a fost golit.").waitFor();
  await page.getByText("Niciun preparat în meniu").waitFor();
  check("clear today's menu", (await page.getByRole("switch", { checked: true }).count()) === 0);
  await setOnMenu(page, sarmale.name, true);
  await setOnMenu(page, ciorba.name, true);
  await ctx.close();
}

console.log("\n== shopping list");
{
  const o1 = await placeOrder(client, sarmale.id, { quantity: 2 });
  await onBoard(kitchen, o1.number, { do: "accept", minutes: 30 });
  const ctx = await context(b, "desktop");
  const page = await login(ctx, adminAcc);
  await page.goto(`${BASE}/admin/shopping`);
  const meat = page.locator("li:visible", { hasText: "Carne tocată de porc" });
  await meat.waitFor();
  const meatText = (await meat.textContent()) ?? "";
  check("quantities multiplied by portions", /\d/.test(meatText) && meatText.includes("Sarmale"), meatText);
  await meat.getByRole("checkbox").click();
  await page.locator("section", { has: page.locator("#bought") }).getByText("Carne tocată de porc").waitFor();
  check("ticked item moves to 'Cumpărate'", true);
  const o2 = await placeOrder(client, sarmale.id);
  await onBoard(kitchen, o2.number, { do: "accept", minutes: 30 });
  await page.getByText(/mai trebuie/).waitFor({ timeout: 10_000 });
  check("new accepted order -> 'still needed' note in real time", true);
  await page.screenshot({ path: `${SHOTS}/admin-shopping-desktop.png`, fullPage: true });
  await page.getByRole("button", { name: "Resetează bifele" }).click();
  await page.getByText("Bifele au fost resetate.").waitFor();
  check("reset ticks", true);
  for (const o of [o1, o2]) await cancelOrder(client, o.id);
  await ctx.close();
}

console.log("\n== users (owner)");
{
  const ctx = await context(b, "desktop");
  const page = await login(ctx, ownerAcc);
  await page.goto(`${BASE}/admin/users`);
  await page.getByRole("button", { name: "Adaugă utilizator" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Utilizator").fill("Test.User");
  await dialog.getByLabel("Nume afișat").fill("Test");
  const password = await dialog.getByLabel("Parolă").inputValue();
  check("a password is generated", password.length >= 12);
  await dialog.getByRole("button", { name: "Creează contul" }).click();
  await page.getByText("Contul Test.User a fost creat.").waitFor();
  check("user created", true);
  await page.screenshot({ path: `${SHOTS}/admin-users-desktop.png` });
  check("new account can sign in", await canSignIn(b, { role: "client", username: "Test.User", password }));

  const testCtx = await context(b, "desktop");
  const testPage = await login(testCtx, { role: "client", username: "Test.User", password });

  await page.getByRole("button", { name: "Acțiuni pentru Test" }).click();
  await page.getByRole("menuitem", { name: "Resetează parola" }).click();
  const newPassword = await page.getByRole("dialog").getByLabel("Parolă").inputValue();
  await page.getByRole("dialog").getByRole("button", { name: "Setează parola" }).click();
  await page.getByText("Parola pentru Test a fost resetată.").waitFor();
  check(
    "reset password works (case-insensitive username)",
    await canSignIn(b, { role: "client", username: "test.user", password: newPassword }),
  );
  check("old password no longer works", !(await canSignIn(b, { role: "client", username: "Test.User", password })));
  await testPage.goto(`${BASE}/orders`);
  check("password reset signs that person out everywhere", new URL(testPage.url()).pathname === "/login");
  await testCtx.close();

  await page.getByRole("button", { name: "Acțiuni pentru Test" }).click();
  await page.getByRole("menuitem", { name: "Șterge contul" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Da, șterge contul" }).click();
  await page.getByText("Contul a fost șters.").waitFor();
  await page.getByText("@Test.User").waitFor({ state: "detached", timeout: 10_000 });
  check("user deleted", true);
  check(
    "deleted account cannot sign in",
    !(await canSignIn(b, { role: "client", username: "Test.User", password: newPassword })),
  );

  await page.getByRole("button", { name: `Acțiuni pentru ${ownerAcc.username}` }).click();
  check(
    "owner cannot delete self (no menu item)",
    (await page.getByRole("menuitem", { name: "Șterge contul" }).count()) === 0,
  );
  await page.keyboard.press("Escape");
  await ctx.close();

  const actx = await context(b, "desktop");
  const apage = await login(actx, adminAcc);
  await apage.goto(`${BASE}/admin/users`);
  check("admin is redirected away from /admin/users", new URL(apage.url()).pathname === "/admin");
  await actx.close();
}

await b.close();
done("admin e2e");
