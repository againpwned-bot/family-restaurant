import fs from "node:fs";
import path from "node:path";

import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";

import type { AppNotification } from "../../lib/types";

export const BASE = process.env.E2E_BASE_URL ?? process.env.PERF_BASE_URL ?? "http://localhost:3000";
export const SHOTS = path.join(process.cwd(), "tests", "e2e", "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });

export type Account = { role: string; username: string; password: string };
const raw = JSON.parse(fs.readFileSync("scripts/users.local.json", "utf8")) as { users?: unknown[] } | unknown[];
const accounts = ((Array.isArray(raw) ? raw : raw.users) ?? []).map((entry): Account => {
  if (typeof entry !== "string") return entry as Account;
  const [role, username, ...rest] = entry.split(":");
  return { role, username, password: rest.join(":") };
});
export const account = (role: "owner" | "admin" | "client", index = 0) => {
  const found = accounts.filter((a) => a.role === role)[index];
  if (!found) throw new Error(`users.local.json needs a ${role} account (#${index + 1}) for the e2e checks`);
  return found;
};

let failures = 0;
export function check(label: string, ok: unknown, extra?: unknown) {
  console.log(ok ? "  ok  " : "  FAIL", label, ok ? "" : extra === undefined ? "" : JSON.stringify(extra));
  if (!ok) failures++;
}
export function done(name: string): never {
  console.log(failures ? `\n${failures} FAILURE(S) in ${name}` : `\nALL ${name.toUpperCase()} CHECKS PASSED`);
  process.exit(failures ? 1 : 0);
}

export async function browser(options: { full?: boolean } = {}): Promise<Browser> {
  return chromium.launch(options.full ? { channel: "chromium" } : {});
}

export async function context(b: Browser, kind: "phone" | "desktop", extra: Parameters<Browser["newContext"]>[0] = {}) {
  const phone = kind === "phone";
  return b.newContext({
    viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: phone ? 2 : 1,
    isMobile: phone,
    hasTouch: phone,
    locale: "ro-RO",
    timezoneId: "Europe/Bucharest",
    ...extra,
  });
}

export async function hydrated(page: Page, selector: string) {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return !!el && Object.keys(el).some((key) => key.startsWith("__reactProps"));
    },
    selector,
    { timeout: 30_000 },
  );
}

export async function login(ctx: BrowserContext, who: Account): Promise<Page> {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("  [pageerror]", e.message));
  await page.goto(`${BASE}/login`);
  await hydrated(page, "#password");
  await page.fill("#username", who.username);
  await page.fill("#password", who.password);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => u.pathname !== "/login", { timeout: 30_000 });
  return page;
}

export async function canSignIn(b: Browser, who: Account): Promise<boolean> {
  const ctx = await context(b, "desktop");
  try {
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`);
    await hydrated(page, "#password");
    await page.fill("#username", who.username);
    await page.fill("#password", who.password);
    await page.click("button[type=submit]");
    return await Promise.race([
      page.waitForURL((u) => u.pathname !== "/login", { timeout: 20_000 }).then(() => true),
      page
        .locator("form [role=alert]")
        .waitFor({ timeout: 20_000 })
        .then(() => false),
    ]);
  } finally {
    await ctx.close();
  }
}

export async function noHorizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

export async function serverAction(page: Page, click: () => Promise<unknown>) {
  const answered = page.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"], {
    timeout: 15_000,
  });
  await click();
  await answered;
}

export async function recordNotifications(ctx: BrowserContext): Promise<AppNotification[]> {
  const list: AppNotification[] = [];
  await ctx.exposeFunction("__e2eNotification", (n: AppNotification) => void list.push(n));
  await ctx.addInitScript(
    `window.addEventListener("app:notification", (e) => window.__e2eNotification(e.detail));`,
  );
  return list;
}

export async function until<T>(fn: () => T | undefined | null | false, ms = 10_000): Promise<T | null> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const value = fn();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 150));
  }
  return null;
}

export async function temporaryAccount(b: Browser): Promise<{ account: Account; remove: () => Promise<void> }> {
  const ctx = await context(b, "desktop");
  const page = await login(ctx, account("owner"));
  await page.goto(`${BASE}/admin/users`);
  const tag = Date.now().toString(36);
  const username = `e2e.${tag}`;
  const displayName = `E2E ${tag}`;
  await page.getByRole("button", { name: "Adaugă utilizator" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Utilizator").fill(username);
  await dialog.getByLabel("Nume afișat").fill(displayName);
  const password = await dialog.getByLabel("Parolă").inputValue();
  await dialog.getByRole("button", { name: "Creează contul" }).click();
  await page.getByText(`Contul ${username} a fost creat.`).waitFor();
  return {
    account: { role: "client", username, password },
    remove: async () => {
      await page.getByRole("button", { name: `Acțiuni pentru ${displayName}` }).click();
      await page.getByRole("menuitem", { name: "Șterge contul" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Da, șterge contul" }).click();
      await page.getByText("Contul a fost șters.").waitFor();
      await ctx.close();
    },
  };
}

export async function dishIds(staff: Page): Promise<Map<string, string>> {
  await staff.goto(`${BASE}/admin/dishes`);
  const links = await staff.locator('a[href^="/admin/dishes/"]').evaluateAll((list) =>
    list.map((a) => [a.getAttribute("aria-label") ?? "", a.getAttribute("href") ?? ""]),
  );
  const map = new Map<string, string>();
  for (const [label, href] of links) {
    const id = href.split("/").pop()!;
    if (/^[0-9a-f-]{36}$/.test(id)) map.set(label.replace(/^Editează /, ""), id);
  }
  return map;
}

export async function sampleDishes(staff: Page) {
  const ids = await dishIds(staff);
  const find = (prefix: string) => {
    const entry = [...ids].find(([name]) => name.startsWith(prefix));
    if (!entry) {
      throw new Error(`Dish "${prefix}..." not found. Stop the app, run "npm run seed:dishes", start it again.`);
    }
    return { name: entry[0], id: entry[1] };
  };
  return { sarmale: find("Sarmale"), ciorba: find("Ciorbă"), mici: find("Mici") };
}

export async function setOnMenu(staff: Page, dishName: string, on: boolean) {
  if (new URL(staff.url()).pathname !== "/admin/menu") await staff.goto(`${BASE}/admin/menu`);
  const toggle = staff.getByRole("switch", { name: `${dishName} în meniul de azi` });
  if (((await toggle.getAttribute("aria-checked")) === "true") === on) return;
  await serverAction(staff, () => toggle.click());
}

export async function clearMenu(staff: Page) {
  await staff.goto(`${BASE}/admin/menu`);
  const clear = staff.getByRole("button", { name: "Golește meniul" });
  if (await clear.isDisabled()) return;
  await clear.click();
  await serverAction(staff, () =>
    staff.getByRole("alertdialog").getByRole("button", { name: "Golește meniul" }).click(),
  );
}

export const orderNo = (number: number) => new RegExp(`#${number}(?!\\d)`);

const boardCard = (staff: Page, number: number) => staff.locator("article:visible", { hasText: orderNo(number) });

type BoardAction =
  | { do: "accept"; minutes?: number }
  | { do: "reject"; reason?: string }
  | { do: "cook" }
  | { do: "extend"; minutes: 5 | 10 }
  | { do: "ready" }
  | { do: "handOver" };

export async function onBoard(staff: Page, number: number, action: BoardAction) {
  if (new URL(staff.url()).pathname !== "/admin") await staff.goto(`${BASE}/admin`);
  const card = boardCard(staff, number);
  await card.waitFor({ timeout: 15_000 });
  const dialog = staff.getByRole("dialog");
  switch (action.do) {
    case "accept":
      await card.getByRole("button", { name: "Acceptă", exact: true }).click();
      await dialog.getByRole("spinbutton").fill(String(action.minutes ?? 20));
      await serverAction(staff, () => dialog.getByRole("button", { name: "Acceptă comanda" }).click());
      break;
    case "reject":
      await card.getByRole("button", { name: "Refuză", exact: true }).click();
      if (action.reason) await dialog.getByLabel("Motiv (opțional)").fill(action.reason);
      await serverAction(staff, () => dialog.getByRole("button", { name: "Refuză comanda" }).click());
      break;
    case "cook":
      await serverAction(staff, () => card.getByRole("button", { name: "Pune pe foc" }).click());
      break;
    case "extend":
      await serverAction(staff, () =>
        card.getByRole("button", { name: `Prelungește cu ${action.minutes} minute` }).click(),
      );
      break;
    case "ready":
      await serverAction(staff, () => card.getByRole("button", { name: "Gata!" }).click());
      break;
    case "handOver":
      await serverAction(staff, () => card.getByRole("button", { name: "Predat" }).click());
      break;
  }
}

export async function clearBoard(staff: Page) {
  await staff.goto(`${BASE}/admin`);
  await staff.getByText("În direct").waitFor({ timeout: 15_000 });
  for (;;) {
    const open = staff.locator("article:visible", {
      has: staff.getByRole("button", { name: /^(Refuză|Gata!|Predat)$/ }),
    });
    if (!(await open.count())) return;
    const card = open.first();
    const reject = card.getByRole("button", { name: "Refuză", exact: true });
    if (await reject.count()) {
      await reject.click();
      await serverAction(staff, () => staff.getByRole("dialog").getByRole("button", { name: "Refuză comanda" }).click());
    } else if (await card.getByRole("button", { name: "Gata!" }).count()) {
      await serverAction(staff, () => card.getByRole("button", { name: "Gata!" }).click());
    } else {
      await serverAction(staff, () => card.getByRole("button", { name: "Predat" }).click());
    }
    await staff.waitForTimeout(300);
  }
}

export type PlacedOrder = { id: string; number: number };

export async function placeOrder(
  client: Page,
  dishId: string,
  options: { quantity?: number; comment?: string } = {},
): Promise<PlacedOrder> {
  await client.goto(`${BASE}/dish/${dishId}`);
  await hydrated(client, "textarea");
  for (let i = 1; i < (options.quantity ?? 1); i++) {
    await client.getByRole("button", { name: "O porție în plus" }).click();
  }
  if (options.comment) await client.getByLabel("Mențiuni (opțional)").fill(options.comment);
  await client.getByRole("button", { name: "Trimite comanda" }).click();
  await client.waitForURL(/\/orders\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  const id = client.url().split("/").pop()!;
  const label = await client.getByText(/Comanda #\d+/).first().textContent();
  return { id, number: Number(label!.match(/#(\d+)/)![1]) };
}

export async function cancelOrder(client: Page, orderId: string) {
  await client.goto(`${BASE}/orders/${orderId}`);
  await client.getByRole("button", { name: "Anulează comanda" }).click();
  await serverAction(client, () => client.getByRole("alertdialog").getByRole("button", { name: "Da, anulează" }).click());
}
