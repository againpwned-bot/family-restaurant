import fs from "node:fs";
import path from "node:path";

import { isAppRole } from "../auth/roles";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, USERNAME_PATTERN } from "../auth/username";
import type { AppRole } from "../types";
import { row, type Db, type Queryable } from "./database";
import { hashPassword } from "./password";

export type SeedUser = { role: AppRole; username: string; password: string; displayName?: string };

export const SEED_FILE = path.join(process.cwd(), "scripts", "users.local.json");

export function readSeedUsers(file = SEED_FILE): SeedUser[] {
  const raw = JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as unknown;
  const list = (Array.isArray(raw) ? raw : (raw as { users?: unknown[] }).users) ?? [];
  if (!Array.isArray(list) || list.length === 0) throw new Error("users.local.json has no users.");

  const users = list.map((entry, index): SeedUser => {
    let user: Partial<SeedUser>;
    if (typeof entry === "string") {
      const [role, username, ...rest] = entry.split(":");
      user = { role: role as AppRole, username, password: rest.join(":") };
    } else {
      user = entry as Partial<SeedUser>;
    }
    const where = `users.local.json entry #${index + 1}`;
    if (!isAppRole(user.role)) throw new Error(`${where}: role must be owner, admin or client.`);
    if (!user.username || !USERNAME_PATTERN.test(user.username.trim())) {
      throw new Error(`${where}: username must be 3-32 characters (letters, digits, _ . -).`);
    }
    const bytes = new TextEncoder().encode(user.password ?? "").length;
    if (!user.password || user.password.length < PASSWORD_MIN_LENGTH || bytes > PASSWORD_MAX_LENGTH) {
      throw new Error(`${where} (${user.username}): password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters.`);
    }
    return {
      role: user.role,
      username: user.username.trim(),
      password: user.password,
      displayName: user.displayName?.trim() || undefined,
    };
  });

  const lower = users.map((u) => u.username.toLowerCase());
  if (new Set(lower).size !== lower.length) throw new Error("users.local.json has duplicate usernames.");
  if (!users.some((u) => u.role === "owner")) throw new Error("users.local.json needs at least one owner.");
  return users;
}

export class UsernameTakenError extends Error {
  constructor() {
    super("username_taken");
  }
}

export async function createAccount(
  db: Db,
  input: { username: string; displayName: string; role: AppRole; password: string },
  actorId?: string,
): Promise<string> {
  const hash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    if (actorId) await tx.query("select set_config('app.user_id', $1, true)", [actorId]);
    const taken = await row(tx, "select 1 from public.profiles where lower(username) = lower($1)", [input.username]);
    if (taken) throw new UsernameTakenError();
    const user = await row<{ id: string }>(tx, "insert into auth.users (password_hash) values ($1) returning id", [
      hash,
    ]);
    await tx.query("insert into public.profiles (id, username, display_name, role) values ($1, $2, $3, $4)", [
      user!.id,
      input.username,
      input.displayName.trim(),
      input.role,
    ]);
    return user!.id;
  });
}

export async function setPassword(db: Queryable, userId: string, password: string, keepSessionId?: string) {
  const hash = await hashPassword(password);
  await db.query("update auth.users set password_hash = $2, password_changed_at = now() where id = $1", [
    userId,
    hash,
  ]);
  await db.query("delete from auth.sessions where user_id = $1 and id is distinct from $2", [
    userId,
    keepSessionId ?? null,
  ]);
}

export async function seedAccounts(db: Db, users: SeedUser[], options: { resetPasswords?: boolean } = {}) {
  const lines: string[] = [];
  for (const user of users) {
    const existing = await row<{ id: string; display_name: string }>(
      db,
      "select id, display_name from public.profiles where lower(username) = lower($1)",
      [user.username],
    );
    if (!existing) {
      await createAccount(db, {
        username: user.username,
        displayName: user.displayName ?? user.username,
        role: user.role,
        password: user.password,
      });
      lines.push(`created  ${user.role.padEnd(6)} ${user.username}`);
      continue;
    }
    await db.query("update public.profiles set role = $2, display_name = coalesce($3, display_name) where id = $1", [
      existing.id,
      user.role,
      user.displayName ?? null,
    ]);
    if (options.resetPasswords) await setPassword(db, existing.id, user.password);
    lines.push(`updated  ${user.role.padEnd(6)} ${user.username}${options.resetPasswords ? " (password reset)" : ""}`);
  }
  return lines;
}

export async function seedAccountsIfEmpty(db: Db, log: (message: string) => void) {
  const count = await row<{ n: number }>(db, "select count(*)::int as n from auth.users");
  if (count && count.n > 0) return;
  if (!fs.existsSync(SEED_FILE)) {
    log(`no accounts yet: create ${path.relative(process.cwd(), SEED_FILE)} (see scripts/users.example.json) and restart`);
    return;
  }
  try {
    for (const line of await seedAccounts(db, readSeedUsers())) log(line);
  } catch (error) {
    log(`could not create the accounts: ${error instanceof Error ? error.message : String(error)}`);
  }
}
