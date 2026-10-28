import "server-only";

import path from "node:path";

import { kitchenDate } from "@/lib/dates";

import { seedAccountsIfEmpty } from "./accounts";
import { dataDir, lockDataDir, openDatabase, row, withUser, type Db, type Tx } from "./database";
import { startPushWorker } from "./push";
import { startChangeFeed } from "./realtime";

const store = globalThis as typeof globalThis & { __meniuDb?: Promise<Db>; __meniuMenuDay?: string };

const log = (message: string) => console.log(`[db] ${message}`);

async function open(): Promise<Db> {
  const dir = dataDir();
  lockDataDir(dir);
  const db = await openDatabase(path.join(dir, "db"), log);
  await seedAccountsIfEmpty(db, log);
  await startChangeFeed(db);
  await startPushWorker(db);
  await syncMenuDay(db);
  setInterval(() => void syncMenuDay(db), 60_000).unref();
  return db;
}

// Puts the dishes planned for today on the menu, once per kitchen day.
async function syncMenuDay(db: Db) {
  const day = kitchenDate();
  if (store.__meniuMenuDay === day) return;
  store.__meniuMenuDay = day;
  try {
    const result = await row<{ n: number }>(db, "select internal.apply_menu_plan() as n");
    if (result?.n) log(`menu plan: ${result.n} dish(es) put on today's menu`);
  } catch (error) {
    store.__meniuMenuDay = undefined;
    console.error("[db] menu plan", error);
  }
}

export function getDb(): Promise<Db> {
  store.__meniuDb ??= open().catch((error) => {
    store.__meniuDb = undefined;
    throw error;
  });
  return store.__meniuDb;
}

export async function asUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await getDb();
  await syncMenuDay(db);
  return withUser(db, userId, fn);
}

// Privileged work (accounts, passwords) that still records who did it in the audit log.
export async function asActor<T>(actorId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.query("select set_config('app.user_id', $1, true)", [actorId]);
    return fn(tx);
  });
}

export async function audit(
  tx: Tx,
  entry: { actorId: string; action: string; entity: string; entityId: string | null; label: string | null },
) {
  await tx.query(
    "insert into public.audit_log (actor_id, action, entity, entity_id, label) values ($1, $2, $3, $4, $5)",
    [entry.actorId, entry.action, entry.entity, entry.entityId, entry.label],
  );
}
