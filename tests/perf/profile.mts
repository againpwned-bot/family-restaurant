// Frame-time profiling of the main transitions, per animation tier, with CPU
// throttling (Chrome DevTools Protocol Emulation.setCPUThrottlingRate).
//
//   npm run build && npm run start   then:
//   PERF_BASE_URL=http://localhost:3100 npx tsx tests/perf/profile.mts
//
// Desktop-full runs on the real GPU when one is available (NVIDIA PRIME offload
// on Linux); phones are emulated (390x844, touch, DPR 2) at 4x and 6x CPU.
// A frame counts as dropped when it took longer than 1.5x the 60 Hz budget.

import fs from "node:fs";
import path from "node:path";

import { chromium, type Browser, type Page } from "playwright-core";

import {
  account,
  browser as e2eBrowser,
  cancelOrder,
  context,
  login,
  onBoard,
  placeOrder,
  sampleDishes,
  setOnMenu,
} from "../e2e/helpers.mjs";

const BASE = process.env.PERF_BASE_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "tests", "perf", "results.json");
const FRAME = 1000 / 60;

// Frame recorder injected into every page (a string: tsx would add helpers).
const RECORDER = `
  window.__perf = {
    frames: [], gen: 0,
    start() { const g = ++this.gen; this.frames = []; const tick = (t) => { if (g !== this.gen) return; this.frames.push(t); requestAnimationFrame(tick); }; requestAnimationFrame(tick); },
    stop() { this.gen++; return this.frames; },
  };
`;

type Result = {
  profile: string;
  scenario: string;
  frames: number;
  avgFps: number;
  p95: number;
  max: number;
  dropped: number;
  tier: string;
};
const results: Result[] = [];

function stats(times: number[]) {
  const d = times.slice(1).map((t, i) => t - times[i]);
  if (!d.length) return { frames: 0, avgFps: 0, p95: 0, max: 0, dropped: 0 };
  const sorted = [...d].sort((a, b) => a - b);
  const total = times[times.length - 1] - times[0];
  return {
    frames: d.length,
    avgFps: Math.round((d.length / total) * 1000 * 10) / 10,
    p95: Math.round(sorted[Math.floor(sorted.length * 0.95)] * 10) / 10,
    max: Math.round(sorted[sorted.length - 1] * 10) / 10,
    dropped: d.filter((x) => x > FRAME * 1.5).length,
  };
}

async function measure(
  page: Page,
  profile: string,
  scenario: string,
  action: () => PromiseLike<unknown>,
  settleMs = 900,
) {
  await page.evaluate("window.__perf.start()");
  await action();
  await page.waitForTimeout(settleMs);
  const times = (await page.evaluate("window.__perf.stop()")) as number[];
  const tier = (await page.evaluate("document.documentElement.dataset.tier")) as string;
  const r = { profile, scenario, tier, ...stats(times) };
  results.push(r);
  console.log(
    `${profile.padEnd(22)} ${scenario.padEnd(30)} tier=${tier.padEnd(7)} fps=${String(r.avgFps).padEnd(5)} p95=${String(r.p95).padEnd(5)}ms max=${String(r.max).padEnd(6)}ms dropped=${r.dropped}/${r.frames}`,
  );
}

async function launch(gpu: boolean): Promise<Browser> {
  const nvidia = fs.existsSync("/usr/share/glvnd/egl_vendor.d/10_nvidia.json");
  return chromium.launch({
    channel: "chromium",
    args: gpu ? ["--use-angle=gl-egl", "--ignore-gpu-blocklist", "--enable-gpu"] : [],
    env:
      gpu && nvidia
        ? ({
            ...process.env,
            __NV_PRIME_RENDER_OFFLOAD: "1",
            __GLX_VENDOR_LIBRARY_NAME: "nvidia",
            __EGL_VENDOR_LIBRARY_FILENAMES: "/usr/share/glvnd/egl_vendor.d/10_nvidia.json",
          } as Record<string, string>)
        : undefined,
  });
}

async function session(b: Browser, kind: "desktop" | "phone", cpu: number) {
  const ctx = await b.newContext(
    kind === "phone"
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ro-RO" }
      : { viewport: { width: 1440, height: 900 }, locale: "ro-RO" },
  );
  await ctx.addInitScript(RECORDER);
  const page = await ctx.newPage();
  const who = account("client");
  await page.goto(`${BASE}/login`);
  await page.fill("#username", who.username);
  await page.fill("#password", who.password);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => u.pathname === "/");
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  await page.waitForTimeout(4500); // tier detection + its 3 s fps check
  return { ctx, page };
}

async function scenarios(page: Page, profile: string, kind: "desktop" | "phone", dishId: string, dishName: string) {
  // 1. Wheel turn (CSS 3D drum; rAF loop stops when settled)
  await page
    .getByRole("radio", { name: "Roată" })
    .click()
    .catch(() => {});
  await page.waitForTimeout(600);
  const wheel = page.getByRole("listbox", { name: "Meniul de azi" });
  if (await wheel.count()) {
    await wheel.focus();
    await measure(page, profile, "wheel: ring -> drum", () => page.keyboard.press("ArrowDown"), 1200);
    await measure(page, profile, "wheel: next dish", () => page.keyboard.press("ArrowDown"), 1200);
    // Idle: the loop must be stopped -> no work, frames only from the recorder.
    await measure(page, profile, "wheel: idle (loop stopped)", async () => {}, 1000);
  }
  // 2. Card flip (3D) in list view
  await page
    .getByRole("radio", { name: "Listă" })
    .click()
    .catch(() => {});
  await page.waitForTimeout(800);
  const flip = page.getByRole("button", { name: `Vezi ingredientele pentru ${dishName}` });
  if (await flip.count()) {
    await measure(page, profile, "card: 3D flip", () => flip.click(), 900);
    await measure(
      page,
      profile,
      "card: flip back",
      () => page.getByRole("button", { name: `Înapoi la poza pentru ${dishName}` }).click(),
      900,
    );
  }
  // 3. Hover tilt (desktop-full) / press tilt (lite)
  const card = page.getByRole("link", { name: `Comandă ${dishName}` });
  const box = await card.boundingBox();
  if (box && kind === "desktop") {
    await measure(
      page,
      profile,
      "card: hover tilt + glare",
      async () => {
        for (let i = 0; i <= 20; i++)
          await page.mouse.move(box.x + (box.width * i) / 20, box.y + box.height / 3 + (i % 5) * 8);
        await page.mouse.move(10, 10);
      },
      600,
    );
  }
  // 4. Shared element: card -> dish overlay, then close
  await measure(
    page,
    profile,
    "card -> dish (shared photo)",
    async () => {
      await card.click();
      await page.getByRole("dialog").waitFor();
    },
    1200,
  );
  await measure(
    page,
    profile,
    "dish overlay: close",
    async () => {
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "detached" });
    },
    900,
  );
  // 5. Page transition
  await measure(
    page,
    profile,
    "page transition -> orders",
    async () => {
      await page.getByRole("link", { name: "Comenzile mele" }).first().click();
      await page.waitForURL(`${BASE}/orders`);
    },
    1000,
  );
  // 6. Live order: status flip + banner (the kitchen advances the order)
  const order = await placeOrder(page, dishId);
  await page.waitForTimeout(1500);
  await measure(
    page,
    profile,
    "order: accepted (flip+banner)",
    () => onBoard(kitchen, order.number, { do: "accept", minutes: 20 }),
    1500,
  );
  await measure(page, profile, "order: timer running (idle)", async () => {}, 2000);
  await cancelOrder(page, order.id);
  // 7. Dish page (desktop-full: 3D plate)
  await page.goto(`${BASE}/dish/${dishId}`);
  await page.waitForTimeout(2500);
  await measure(page, profile, "dish page (3D plate if full)", async () => {}, 2000);
  // 8. Home idle (desktop-full: WebGL steam background)
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(3000);
  await measure(page, profile, "home idle (WebGL bg if full)", async () => {}, 2000);
}

// The kitchen side runs in its own (unthrottled) browser.
const kitchenBrowser = await e2eBrowser();
const kitchen = await login(await context(kitchenBrowser, "desktop"), account("admin"));
const target = (await sampleDishes(kitchen)).sarmale;
await setOnMenu(kitchen, target.name, true);

const plans: { name: string; gpu: boolean; kind: "desktop" | "phone"; cpu: number }[] = [
  { name: "desktop GPU, CPU 2x", gpu: true, kind: "desktop", cpu: 2 },
  { name: "desktop soft-GL, CPU 2x", gpu: false, kind: "desktop", cpu: 2 },
  { name: "phone, CPU 4x", gpu: true, kind: "phone", cpu: 4 },
  { name: "phone, CPU 6x", gpu: true, kind: "phone", cpu: 6 },
];
for (const plan of plans) {
  const b = await launch(plan.gpu);
  const { ctx, page } = await session(b, plan.kind, plan.cpu);
  await scenarios(page, plan.name, plan.kind, target.id, target.name);
  await ctx.close();
  await b.close();
}
await kitchenBrowser.close();
fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
console.log(`\nwrote ${path.relative(process.cwd(), OUT)}`);
process.exit(0);
