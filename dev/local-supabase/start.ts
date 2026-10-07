// `npm run dev:local`: the whole app on localhost without a Supabase project.
// Starts the emulator, creates the accounts from scripts/users.local.json on
// the first run, then runs `next dev` pointed at the emulator.
//
//   npm run dev:local            emulator + Next.js dev server
//   npm run dev:local -- --api   emulator only

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { PUBLISHABLE_KEY, SECRET_KEY } from "./jwt";
import { EMULATOR_URL, startEmulator } from "./server";

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: EMULATOR_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: SECRET_KEY,
  LOCAL_SUPABASE: "1",
};

function run(command: string, args: string[]) {
  return spawn(command, args, { stdio: "inherit", env, shell: process.platform === "win32" });
}

async function main() {
  const { db } = await startEmulator({ quiet: process.argv.includes("--quiet") });
  console.log(`\n[local] Supabase emulator on ${EMULATOR_URL}`);

  const users = (await db.query<{ n: number }>("select count(*)::int as n from auth.users")).rows[0].n;
  const usersFile = path.join(process.cwd(), "scripts", "users.local.json");
  if (users === 0 && fs.existsSync(usersFile)) {
    console.log("[local] first run: creating accounts from scripts/users.local.json");
    await new Promise<void>((resolve) => run("npx", ["tsx", "scripts/seed-users.ts"]).on("exit", () => resolve()));
  }

  if (process.argv.includes("--api")) return;

  const next = run("npx", ["next", "dev", ...process.argv.slice(2).filter((a) => !a.startsWith("--q"))]);
  const stop = () => {
    next.kill("SIGINT");
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  next.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
