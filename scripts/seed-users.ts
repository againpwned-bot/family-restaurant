// Creates / updates the family accounts from scripts/users.local.json.
//
//   npm run seed:users                     create missing users, sync roles + profiles
//   npm run seed:users -- --reset-passwords  also set every password from the file
//
// There is no public sign-up: this script (and the owner's Users page) is the
// only way accounts come to exist. Passwords are never printed.

import fs from "node:fs";
import path from "node:path";

import { isAppRole } from "../lib/auth/roles";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, USERNAME_PATTERN, usernameToEmail } from "../lib/auth/username";
import type { AppRole } from "../lib/supabase/database.types";
import { adminClient, fail } from "./lib/supabase-admin";

type SeedUser = { role: AppRole; username: string; password: string; displayName?: string };

const FILE = path.join(process.cwd(), "scripts", "users.local.json");

function readUsers(): SeedUser[] {
  if (!fs.existsSync(FILE)) {
    fail(`${path.relative(process.cwd(), FILE)} not found. Copy scripts/users.example.json and fill it in.`);
  }
  const raw = JSON.parse(fs.readFileSync(FILE, "utf8")) as unknown;
  const list = (Array.isArray(raw) ? raw : (raw as { users?: unknown[] }).users) ?? [];
  if (!Array.isArray(list) || list.length === 0) fail("users.local.json has no users.");

  return list.map((entry, index): SeedUser => {
    // Accepts { role, username, password, displayName? } or "role:username:password".
    let user: Partial<SeedUser>;
    if (typeof entry === "string") {
      const [role, username, ...rest] = entry.split(":");
      user = { role: role as AppRole, username, password: rest.join(":") };
    } else {
      user = entry as Partial<SeedUser>;
    }
    const where = `entry #${index + 1}`;
    if (!isAppRole(user.role)) fail(`${where}: role must be owner, admin or client.`);
    if (!user.username || !USERNAME_PATTERN.test(user.username)) {
      fail(`${where}: username must be 3-32 characters (letters, digits, _ . -).`);
    }
    if (!user.password || user.password.length < PASSWORD_MIN_LENGTH || user.password.length > PASSWORD_MAX_LENGTH) {
      fail(`${where} (${user.username}): password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters.`);
    }
    return {
      role: user.role,
      username: user.username.trim(),
      password: user.password,
      displayName: user.displayName?.trim() || undefined,
    };
  });
}

async function main() {
  const resetPasswords = process.argv.includes("--reset-passwords");
  const users = readUsers();

  const lower = users.map((u) => u.username.toLowerCase());
  if (new Set(lower).size !== lower.length) fail("Duplicate usernames in users.local.json.");
  if (!users.some((u) => u.role === "owner")) fail("At least one user must have the owner role.");

  const supabase = adminClient();

  // Existing auth users by email (a family has a handful, one page is plenty).
  const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) fail(`Could not list users: ${listError.message}`);
  const byEmail = new Map(listed.users.map((u) => [u.email?.toLowerCase(), u]));

  for (const user of users) {
    const email = usernameToEmail(user.username);
    const existing = byEmail.get(email);
    let id: string;

    if (!existing) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: user.password,
        email_confirm: true,
        app_metadata: { role: user.role },
        user_metadata: { username: user.username },
      });
      if (error || !data.user) fail(`Could not create ${user.username}: ${error?.message}`);
      id = data.user.id;
      console.log(`✓ created  ${user.role.padEnd(6)} ${user.username}`);
    } else {
      id = existing.id;
      const { error } = await supabase.auth.admin.updateUserById(id, {
        app_metadata: { ...existing.app_metadata, role: user.role },
        ...(resetPasswords ? { password: user.password } : {}),
      });
      if (error) fail(`Could not update ${user.username}: ${error.message}`);
      console.log(`✓ updated  ${user.role.padEnd(6)} ${user.username}${resetPasswords ? " (password reset)" : ""}`);
    }

    const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", id).maybeSingle();
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id,
        username: user.username,
        role: user.role,
        display_name: user.displayName ?? profile?.display_name ?? user.username,
      },
      { onConflict: "id" },
    );
    if (profileError) fail(`Could not save the profile of ${user.username}: ${profileError.message}`);
  }

  console.log(
    `\nDone: ${users.length} account(s). Existing passwords were ${resetPasswords ? "reset" : "left unchanged"}.`,
  );
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
