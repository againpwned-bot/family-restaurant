// Creates / updates the family accounts from scripts/users.local.json.
//
//   npm run seed:users                       create missing users, sync roles + display names
//   npm run seed:users -- --reset-passwords  also set every password from the file
//
// The app does this by itself on its very first start (when there are no
// accounts yet); afterwards the owner manages people on the Users page. This
// script is for re-syncing from the file. Stop the app first: only one
// process may open the database. Passwords are never printed.

import fs from "node:fs";
import path from "node:path";

import { SEED_FILE, readSeedUsers, seedAccounts } from "../lib/server/accounts";
import { dataDir, lockDataDir, openDatabase } from "../lib/server/database";

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function main() {
  const resetPasswords = process.argv.includes("--reset-passwords");
  if (!fs.existsSync(SEED_FILE)) {
    fail(`${path.relative(process.cwd(), SEED_FILE)} not found. Copy scripts/users.example.json and fill it in.`);
  }
  const users = readSeedUsers();

  const dir = dataDir();
  lockDataDir(dir);
  const db = await openDatabase(path.join(dir, "db"), (m) => console.log(`· ${m}`));
  try {
    for (const line of await seedAccounts(db, users, { resetPasswords })) console.log(`✓ ${line}`);
  } finally {
    await db.close();
  }

  console.log(
    `\nDone: ${users.length} account(s). Existing passwords were ${resetPasswords ? "reset (and those people signed out)" : "left unchanged"}.`,
  );
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
