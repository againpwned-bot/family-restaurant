// Shared helpers for the end-to-end checks. They run against the local stack:
//   terminal 1: npm run dev:local
//   terminal 2: npm run test:e2e
// Accounts come from scripts/users.local.json; passwords are never printed.

import fs from "node:fs";
import path from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import WebSocket from "ws";

import type { Database } from "../../lib/types";
import { PUBLISHABLE_KEY } from "../../dev/local-supabase/jwt";

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
export const API = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const SHOTS = path.join(process.cwd(), "tests", "e2e", "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });

type Account = { role: string; username: string; password: string };
const accounts = (JSON.parse(fs.readFileSync("scripts/users.local.json", "utf8")).users as Account[]).map((a) => a);
export const account = (role: "owner" | "admin" | "client", index = 0) =>
  accounts.filter((a) => a.role === role)[index];

let failures = 0;
export function check(label: string, ok: unknown, extra?: unknown) {
  console.log(ok ? "  ok  " : "  FAIL", label, ok ? "" : extra === undefined ? "" : JSON.stringify(extra));
  if (!ok) failures++;
}
export function done(name: string): never {
  console.log(failures ? `\n${failures} FAILURE(S) in ${name}` : `\nALL ${name.toUpperCase()} CHECKS PASSED`);
  process.exit(failures ? 1 : 0);
}

/** `full` uses the complete Chromium build (new headless), needed for notifications. */
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

export async function login(ctx: BrowserContext, who: Account): Promise<Page> {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("  [pageerror]", e.message));
  await page.goto(`${BASE}/login`);
  await page.fill("#username", who.username);
  await page.fill("#password", who.password);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => u.pathname !== "/login", { timeout: 30_000 });
  return page;
}

/** supabase-js signed in as an account, for doing the "other side" of a flow. */
export async function api(who: Account): Promise<SupabaseClient<Database>> {
  const client = createClient<Database>(API, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
  });
  const { error } = await client.auth.signInWithPassword({
    email: `${who.username.toLowerCase()}@meniu.local`,
    password: who.password,
  });
  if (error) throw new Error(`api login failed for ${who.username}: ${error.message}`);
  return client;
}

export async function noHorizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}
