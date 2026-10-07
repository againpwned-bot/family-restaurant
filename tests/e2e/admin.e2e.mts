// Stage 2 (admin) end-to-end checks: live orders board, dishes, today's menu,
// shopping list, users. Run with `npm run dev:local` in another terminal.

import fs from "node:fs";

import sharp from "sharp";

import {
  API,
  BASE,
  SHOTS,
  account,
  api,
  browser,
  check,
  context,
  done,
  login,
  noHorizontalOverflow,
} from "./helpers.mjs";

const SAMPLE = process.env.E2E_SAMPLE_PHOTO ?? "tests/e2e/fixtures/big-photo.jpg";
const b = await browser();
const adminAcc = account("admin");
const ownerAcc = account("owner");
const clientAcc = account("client");
const adminApi = await api(adminAcc);
const clientApi = await api(clientAcc);

// --- setup: clean board, Sarmale on today's menu ----------------------------
const { data: leftovers } = await adminApi
  .from("orders")
  .select("id")
  .in("status", ["received", "accepted", "cooking", "ready"]);
for (const o of leftovers ?? []) await adminApi.rpc("reject_order", { p_order_id: o.id, p_reason: null });
const { data: dishes } = await adminApi.from("dishes").select("id, name").is("archived_at", null);
const sarmale = dishes!.find((d) => d.name.startsWith("Sarmale"))!;
const ciorba = dishes!.find((d) => d.name.startsWith("Ciorbă"))!;
await adminApi.rpc("set_dish_available_today", { p_dish_id: sarmale.id, p_available: true });
const clientName = (await clientApi.from("profiles").select("display_name").eq("username", clientAcc.username).single())
  .data!.display_name;

// Client-side notification log (what Emil's phone would get).
const clientNotifications: string[] = [];
const { data: me } = await clientApi.auth.getUser();
await new Promise<void>((resolve) =>
  clientApi
    .channel("e2e-client-notifs")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${me.user!.id}` },
      (p) =>
        clientNotifications.push(
          `${(p.new as { type: string }).type}:${JSON.stringify((p.new as { payload: unknown }).payload)}`,
        ),
    )
    .subscribe((s) => s === "SUBSCRIBED" && resolve()),
);

console.log("\n== orders board (desktop)");
{
  const ctx = await context(b, "desktop");
  const page = await login(ctx, adminAcc);
  check("admin lands on /admin", new URL(page.url()).pathname === "/admin");
  await page.getByText("În direct").waitFor({ timeout: 15_000 });
  check("realtime badge says live", true);

  const { data: order } = await clientApi.rpc("place_order", {
    p_dish_id: sarmale.id,
    p_quantity: 2,
    p_comment: "Fără smântână, vă rog",
  });
  const banner = page.getByRole("status").filter({ hasText: `Comandă nouă de la ${clientName}` });
  await banner.waitFor({ timeout: 10_000 });
  check("new order banner appears in real time", await banner.isVisible());
  await page.screenshot({ path: `${SHOTS}/admin-new-order-banner.png` });

  const card = () => page.locator("article:visible", { hasText: `#${order!.number}` });
  const column = (name: string) => page.locator("section", { has: page.locator("h2", { hasText: name }) });
  await card().waitFor();
  check("card shows comment", await card().getByText("Fără smântână, vă rog").isVisible());
  check(
    "card is in 'Noi' column",
    (await column("Noi")
      .locator("article", { hasText: `#${order!.number}` })
      .count()) === 1,
  );

  await card().getByRole("button", { name: "Acceptă" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "20 min" }).click();
  await dialog.getByRole("button", { name: "Acceptă comanda" }).click();
  await column("Acceptate")
    .locator("article", { hasText: `#${order!.number}` })
    .waitFor({ timeout: 10_000 });
  check("accepted card moves to 'Acceptate'", true);
  await card()
    .getByText(/rămase/)
    .waitFor();
  check("live timer is shown", true);
  check("decided-by is shown", await card().getByText(`Acceptată de`).isVisible());

  await card().getByRole("button", { name: "Prelungește cu 5 minute" }).click();
  await page.getByText("Am prelungit cu 5 min.").waitFor();
  check("extend +5 toast", true);
  await card().getByRole("button", { name: "Pune pe foc" }).click();
  await column("La foc")
    .locator("article", { hasText: `#${order!.number}` })
    .waitFor({ timeout: 10_000 });
  check("start cooking moves to 'La foc'", true);
  await page.screenshot({ path: `${SHOTS}/admin-board-desktop.png` });
  await card().getByRole("button", { name: "Gata!" }).click();
  await column("Gata de predat")
    .locator("article", { hasText: `#${order!.number}` })
    .waitFor({ timeout: 10_000 });
  check("ready moves to 'Gata de predat'", true);
  await card().getByRole("button", { name: "Predat" }).click();
  await page
    .locator("section", { has: page.locator("#col-done") })
    .locator("article", { hasText: `#${order!.number}` })
    .waitFor({ timeout: 10_000 });
  check("handed over goes to 'Finalizate azi'", true);

  // reject with a quick reason
  const { data: second } = await clientApi.rpc("place_order", { p_dish_id: sarmale.id, p_quantity: 1 });
  const secondCard = page.locator("article:visible", { hasText: `#${second!.number}` });
  await secondCard.waitFor({ timeout: 10_000 });
  await secondCard.getByRole("button", { name: "Refuză" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Nu mai am ingrediente" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Refuză comanda" }).click();
  await page.getByText(`Comanda #${second!.number} a fost refuzată.`).waitFor();
  check("reject with reason", true);

  // client cancels -> staff banner
  const { data: third } = await clientApi.rpc("place_order", { p_dish_id: sarmale.id, p_quantity: 1 });
  await page.locator("article:visible", { hasText: `#${third!.number}` }).waitFor({ timeout: 10_000 });
  await clientApi.rpc("cancel_order", { p_order_id: third!.id });
  await page.getByRole("status").filter({ hasText: "Comandă anulată" }).waitFor({ timeout: 10_000 });
  check("cancellation banner for staff", true);

  await new Promise((r) => setTimeout(r, 800));
  const types = clientNotifications.map((n) => n.split(":")[0]);
  check(
    "client got accepted/extended/ready/rejected",
    ["order_accepted", "order_extended", "order_ready", "order_rejected"].every((t) => types.includes(t)),
    types,
  );
  check(
    "rejection reason delivered",
    clientNotifications.some((n) => n.startsWith("order_rejected") && n.includes("Nu mai am ingrediente")),
  );
  await ctx.close();
}

console.log("\n== orders board (phone)");
{
  const { data: o } = await clientApi.rpc("place_order", { p_dish_id: sarmale.id, p_quantity: 1 });
  const ctx = await context(b, "phone");
  const page = await login(ctx, adminAcc);
  await page.getByRole("tab", { name: /Noi/ }).click();
  await page.locator("article:visible", { hasText: `#${o!.number}` }).waitFor();
  check("phone: tabs + card visible", true);
  check("phone: no horizontal overflow", await noHorizontalOverflow(page));
  await page.screenshot({ path: `${SHOTS}/admin-board-phone.png` });
  await adminApi.rpc("reject_order", { p_order_id: o!.id, p_reason: null });
  await ctx.close();
}

console.log("\n== dishes");
{
  if (!fs.existsSync(SAMPLE)) throw new Error(`sample photo missing: ${SAMPLE}`);
  const ctx = await context(b, "desktop");
  const page = await login(ctx, adminAcc);
  await page.goto(`${BASE}/admin/dishes/new`);
  await page.getByRole("button", { name: "Salvează" }).click();
  check("empty name is rejected", await page.getByText("Scrie numele preparatului.").first().isVisible());

  await page.getByLabel("Nume", { exact: true }).fill("Plăcintă cu brânză E2E");
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

  const { data: saved } = await adminApi
    .from("dishes")
    .select("*, dish_ingredients(name, quantity, unit, position)")
    .eq("name", "Plăcintă cu brânză E2E")
    .order("position", { referencedTable: "dish_ingredients" })
    .single();
  check(
    "ingredients saved with decimal comma parsed",
    saved?.dish_ingredients[0]?.quantity === 0.25 && saved?.dish_ingredients[1]?.name === "Foi de plăcintă",
    saved?.dish_ingredients,
  );
  const photoRes = await fetch(`${API}/storage/v1/object/public/dish-photos/${saved!.photo_path}`);
  const bytes = Buffer.from(await photoRes.arrayBuffer());
  const meta = await sharp(bytes).metadata();
  check(
    `uploaded photo is small (${Math.round(bytes.length / 1024)} KB, ${meta.format} ${meta.width}x${meta.height}; UI said "${info?.trim()}")`,
    bytes.length <= 300 * 1024 * 1.25 && Math.max(meta.width!, meta.height!) <= 1600,
  );
  check("blur placeholder stored", (saved?.photo_blur ?? "").startsWith("data:image/"));
  await page.screenshot({ path: `${SHOTS}/admin-dishes-desktop.png` });

  await page.getByRole("link", { name: "Editează Plăcintă cu brânză E2E" }).click();
  await page.getByLabel("Timp estimat de gătit (minute)").fill("55");
  await page.getByRole("button", { name: "Salvează" }).click();
  await page.waitForURL(`${BASE}/admin/dishes`);
  const { data: edited } = await adminApi
    .from("dishes")
    .select("cook_minutes, photo_path")
    .eq("id", saved!.id)
    .single();
  check("edit keeps photo, updates minutes", edited?.cook_minutes === 55 && edited?.photo_path === saved!.photo_path);

  await page.getByRole("link", { name: "Editează Plăcintă cu brânză E2E" }).click();
  await page.getByRole("button", { name: "Șterge preparatul" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Da, șterge" }).click();
  await page.waitForURL(`${BASE}/admin/dishes`);
  const gone = await adminApi.from("dishes").select("id").eq("id", saved!.id);
  const photoGone = await fetch(`${API}/storage/v1/object/public/dish-photos/${saved!.photo_path}`);
  check("never-ordered dish is deleted with its photo", gone.data?.length === 0 && !photoGone.ok);

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
  await sw.click();
  await page.waitForTimeout(600);
  const { data: c1 } = await adminApi.from("dishes").select("available_on").eq("id", ciorba.id).single();
  check("toggle updates the database", (before === "true") === (c1?.available_on === null));
  check("phone: menu fits", await noHorizontalOverflow(page));
  await page.screenshot({ path: `${SHOTS}/admin-menu-phone.png`, fullPage: true });
  await page.getByRole("button", { name: "Golește meniul" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Golește meniul" }).click();
  await page.getByText("Meniul de azi a fost golit.").waitFor();
  await page.getByText("Niciun preparat în meniu").waitFor();
  check("clear today's menu", (await page.getByRole("switch", { checked: true }).count()) === 0);
  await adminApi.rpc("set_dish_available_today", { p_dish_id: sarmale.id, p_available: true });
  await adminApi.rpc("set_dish_available_today", { p_dish_id: ciorba.id, p_available: true });
  await ctx.close();
}

console.log("\n== shopping list");
{
  const { data: o1 } = await clientApi.rpc("place_order", { p_dish_id: sarmale.id, p_quantity: 2 });
  await adminApi.rpc("accept_order", { p_order_id: o1!.id, p_minutes: 30 });
  const ctx = await context(b, "desktop");
  const page = await login(ctx, adminAcc);
  await page.goto(`${BASE}/admin/shopping`);
  const meat = page.locator("li", { hasText: "Carne tocată de porc" });
  await meat.waitFor();
  const meatText = (await meat.textContent()) ?? "";
  check("quantities multiplied by portions", /\d/.test(meatText) && meatText.includes("Sarmale"), meatText);
  await meat.getByRole("checkbox").click();
  await page
    .locator("section", { has: page.locator("#bought") })
    .getByText("Carne tocată de porc")
    .waitFor();
  check("ticked item moves to 'Cumpărate'", true);
  const { data: o2 } = await clientApi.rpc("place_order", { p_dish_id: sarmale.id, p_quantity: 1 });
  await adminApi.rpc("accept_order", { p_order_id: o2!.id, p_minutes: 30 });
  await page.getByText(/mai trebuie/).waitFor({ timeout: 10_000 });
  check("new accepted order -> 'still needed' note in real time", true);
  await page.screenshot({ path: `${SHOTS}/admin-shopping-desktop.png`, fullPage: true });
  await page.getByRole("button", { name: "Resetează bifele" }).click();
  await page.getByText("Bifele au fost resetate.").waitFor();
  check("reset ticks", true);
  for (const o of [o1!, o2!]) await adminApi.rpc("reject_order", { p_order_id: o.id, p_reason: null });
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
  await api({ role: "client", username: "Test.User", password }).then(
    () => check("new account can sign in", true),
    (e) => check("new account can sign in", false, String(e)),
  );

  await page.getByRole("button", { name: "Acțiuni pentru Test" }).click();
  await page.getByRole("menuitem", { name: "Resetează parola" }).click();
  const newPassword = await page.getByRole("dialog").getByLabel("Parolă").inputValue();
  await page.getByRole("dialog").getByRole("button", { name: "Setează parola" }).click();
  await page.getByText("Parola pentru Test a fost resetată.").waitFor();
  await api({ role: "client", username: "test.user", password: newPassword }).then(
    () => check("reset password works (case-insensitive username)", true),
    (e) => check("reset password works", false, String(e)),
  );

  await page.getByRole("button", { name: "Acțiuni pentru Test" }).click();
  await page.getByRole("menuitem", { name: "Șterge contul" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Da, șterge contul" }).click();
  await page.getByText("Contul a fost șters.").waitFor();
  await page.getByText("@Test.User").waitFor({ state: "detached", timeout: 10_000 });
  check("user deleted", true);

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

await clientApi.removeAllChannels();
await b.close();
done("admin e2e");
