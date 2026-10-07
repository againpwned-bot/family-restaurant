// The app's database: PGlite (Postgres compiled to WebAssembly) storing its
// files under data/db on this computer. No database server to install.
//
// This module has no Next.js dependencies so the scripts and tests can use it
// too; the app itself goes through lib/server/db.ts (one shared instance).

import fs from "node:fs";
import path from "node:path";

import { PGlite, types, type Transaction } from "@electric-sql/pglite";

export type Db = PGlite;
export type Tx = Transaction;
export type Queryable = PGlite | Transaction;

/** Where everything that belongs to this computer lives: database, photos, keys. */
export function dataDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.MENIU_DATA_DIR || path.join(process.cwd(), "data"));
}

const DB_FOLDER = path.join(process.cwd(), "db");

// Values come back the way the UI expects them (as they would in JSON):
// timestamps as ISO strings, dates as "YYYY-MM-DD", bigint/numeric as numbers.
const parsers = {
  [types.TIMESTAMPTZ]: (value: string) => isoTimestamp(value),
  [types.TIMESTAMP]: (value: string) => isoTimestamp(value),
  [types.DATE]: (value: string) => value,
  [types.INT8]: (value: string) => Number(value),
  [types.NUMERIC]: (value: string) => Number(value),
};

function isoTimestamp(value: string): string {
  // "2026-10-07 09:15:00.123+00" -> "2026-10-07T09:15:00.123Z"
  const normalised = value.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00");
  const date = new Date(normalised);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

/**
 * Opens (and creates on first use) the database, then applies the bootstrap
 * and any new migration from db/migrations. `null` = in memory (tests).
 */
export async function openDatabase(location: string | null, log: (message: string) => void = () => {}) {
  if (location) fs.mkdirSync(location, { recursive: true });
  const db = new PGlite({ dataDir: location ?? undefined, parsers });
  await db.waitReady;
  await db.exec("set timezone = 'UTC'");
  await migrate(db, log);
  return db;
}

export async function migrate(db: PGlite, log: (message: string) => void = () => {}) {
  await db.exec(fs.readFileSync(path.join(DB_FOLDER, "bootstrap.sql"), "utf8"));

  const folder = path.join(DB_FOLDER, "migrations");
  const files = fs
    .readdirSync(folder)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const applied = new Set(
    (await db.query<{ name: string }>("select name from internal.migrations")).rows.map((row) => row.name),
  );
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(folder, file), "utf8");
    await db.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query("insert into internal.migrations (name) values ($1)", [file]);
    });
    log(`applied ${file}`);
  }
}

/**
 * Runs `fn` in one transaction as `userId`: the `authenticated` role with
 * auth.uid() = userId, so row level security applies exactly as for that user.
 */
export async function withUser<T>(db: PGlite, userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('app.user_id', $1, true)", [userId]);
    await tx.exec("set local role authenticated");
    return fn(tx);
  });
}

/** Rows of a query, typed. */
export async function rows<T>(db: Queryable, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

/** First row of a query, or null. */
export async function row<T>(db: Queryable, sql: string, params: unknown[] = []): Promise<T | null> {
  return (await db.query<T>(sql, params)).rows[0] ?? null;
}

/**
 * Only one process may open the database folder at a time (two would corrupt
 * it). The lock holds the owner's PID; a lock left by a crashed process is
 * taken over.
 */
export function lockDataDir(location: string) {
  fs.mkdirSync(location, { recursive: true });
  const lockFile = path.join(location, "db.lock");
  try {
    const pid = Number(fs.readFileSync(lockFile, "utf8"));
    if (pid && pid !== process.pid && processAlive(pid)) {
      throw new Error(
        `The database in ${location} is in use by another process (PID ${pid}). ` +
          "Stop the app (npm run dev / npm start) before running scripts, or the other way round.",
      );
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  fs.writeFileSync(lockFile, String(process.pid));
  process.once("exit", () => {
    try {
      if (Number(fs.readFileSync(lockFile, "utf8")) === process.pid) fs.rmSync(lockFile);
    } catch {
      // already gone
    }
  });
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}
