import "server-only";

import path from "node:path";

import { seedAccountsIfEmpty } from "./accounts";
import { dataDir, lockDataDir, openDatabase, withUser, type Db, type Tx } from "./database";
import { startPushWorker } from "./push";
import { startChangeFeed } from "./realtime";

// One database for the whole server process, opened on first use. Kept on
// globalThis so hot reloads in development don't open it twice.
const store = globalThis as typeof globalThis & { __meniuDb?: Promise<Db> };

const log = (message: string) => console.log(`[db] ${message}`);

async function open(): Promise<Db> {
  const dir = dataDir();
  lockDataDir(dir);
  const db = await openDatabase(path.join(dir, "db"), log);
  await seedAccountsIfEmpty(db, log);
  await startChangeFeed(db);
  await startPushWorker(db);
  return db;
}

export function getDb(): Promise<Db> {
  store.__meniuDb ??= open().catch((error) => {
    store.__meniuDb = undefined;
    throw error;
  });
  return store.__meniuDb;
}

/** Runs `fn` as the given user: row level security applies (see db/migrations/0002_rls.sql). */
export async function asUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withUser(await getDb(), userId, fn);
}
