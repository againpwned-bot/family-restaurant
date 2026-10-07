// PGlite database for the local emulator: bootstrap stand-ins, the real
// migrations from supabase/migrations, and per-request role + JWT claims so
// row level security behaves like on Supabase.

import fs from "node:fs";
import path from "node:path";

import { PGlite, type Transaction } from "@electric-sql/pglite";

export type Claims = { sub?: string; role: "anon" | "authenticated" | "service_role"; [key: string]: unknown };
export type Tx = Transaction;

const ROOT = process.cwd();
const HERE = path.join(ROOT, "dev", "local-supabase");

export async function openDatabase(dataDir: string | null) {
  if (dataDir) fs.mkdirSync(dataDir, { recursive: true });
  const db = dataDir ? new PGlite(dataDir) : new PGlite();
  await db.waitReady;

  await db.exec(fs.readFileSync(path.join(HERE, "bootstrap.sql"), "utf8"));
  await db.exec(`
    create schema if not exists _local;
    create table if not exists _local.migrations (name text primary key, applied_at timestamptz default now());
    create table if not exists _local.refresh_tokens (
      token text primary key,
      user_id uuid not null,
      session_id uuid not null,
      revoked boolean not null default false,
      created_at timestamptz not null default now()
    );
    grant usage on schema _local to anon, authenticated, service_role;
  `);

  const migrationsDir = path.join(ROOT, "supabase", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const applied = new Set(
    (await db.query<{ name: string }>("select name from _local.migrations")).rows.map((r) => r.name),
  );
  for (const file of files) {
    if (applied.has(file)) continue;
    await db.exec(fs.readFileSync(path.join(migrationsDir, file), "utf8"));
    await db.query("insert into _local.migrations (name) values ($1)", [file]);
    console.log(`[db] applied ${file}`);
  }

  await installChangeFeed(db);
  return db;
}

/** Row-level change notifications for every table in the supabase_realtime publication. */
async function installChangeFeed(db: PGlite) {
  await db.exec(`
    create or replace function _local.realtime_notify() returns trigger
    language plpgsql security definer as $$
    declare
      v_row jsonb := to_jsonb(coalesce(new, old));
      v_pk jsonb := '{}'::jsonb;
      v_col text;
    begin
      foreach v_col in array tg_argv loop
        v_pk := v_pk || jsonb_build_object(v_col, v_row -> v_col);
      end loop;
      perform pg_notify('_local_changes', jsonb_build_object(
        'schema', tg_table_schema, 'table', tg_table_name, 'type', tg_op, 'pk', v_pk,
        'at', now()
      )::text);
      return null;
    end;
    $$;
  `);

  const tables = await db.query<{ schemaname: string; tablename: string }>(
    "select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime'",
  );
  for (const { schemaname, tablename } of tables.rows) {
    const pk = await primaryKey(db, schemaname, tablename);
    const args = pk.map((c) => `'${c}'`).join(", ");
    await db.exec(`
      drop trigger if exists _local_realtime on "${schemaname}"."${tablename}";
      create trigger _local_realtime after insert or update or delete on "${schemaname}"."${tablename}"
        for each row execute function _local.realtime_notify(${args});
    `);
  }
}

export async function primaryKey(db: PGlite | Tx, schema: string, table: string): Promise<string[]> {
  const res = await db.query<{ attname: string }>(
    `select a.attname from pg_index i
       join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
      where i.indrelid = format('%I.%I', $1::text, $2::text)::regclass and i.indisprimary
      order by array_position(i.indkey, a.attnum)`,
    [schema, table],
  );
  return res.rows.map((r) => r.attname);
}

/** Runs `fn` in one transaction as the given Postgres role with the JWT claims set. */
export async function asRole<T>(db: PGlite, claims: Claims, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [claims.sub ?? ""]);
    await tx.query("select set_config('request.jwt.claim.role', $1, true)", [claims.role]);
    await tx.exec(`set local role ${claims.role}`);
    return fn(tx);
  });
}
