"use server";

import { revalidatePath } from "next/cache";

import { requireProfile } from "@/lib/auth/dal";
import { isAppRole } from "@/lib/auth/roles";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, isValidUsername } from "@/lib/auth/username";
import { UsernameTakenError, createAccount, setPassword } from "@/lib/server/accounts";
import { row, type Queryable } from "@/lib/server/database";
import { getDb } from "@/lib/server/db";
import type { AppRole } from "@/lib/types";

// Owner-only user management. Every action re-checks the caller's role from
// the database first; the writes then run with full database rights.

export type UserError =
  | "usernameInvalid"
  | "usernameTaken"
  | "displayNameRequired"
  | "passwordTooShort"
  | "passwordTooLong"
  | "roleInvalid"
  | "cannotDeleteSelf"
  | "lastOwner"
  | "cannotChangeOwnRole"
  | "notFound"
  | "unknown";

export type UserResult = { ok: true } | { ok: false; error: UserError };

function checkPassword(password: string): UserError | null {
  if (password.length < PASSWORD_MIN_LENGTH) return "passwordTooShort";
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_LENGTH) return "passwordTooLong";
  return null;
}

function checkDisplayName(name: string): UserError | null {
  const trimmed = name.trim();
  return trimmed.length < 1 || trimmed.length > 60 ? "displayNameRequired" : null;
}

async function ownerCount(db: Queryable) {
  return (await row<{ n: number }>(db, "select count(*)::int as n from public.profiles where role = 'owner'"))?.n ?? 0;
}

export async function createUser(input: {
  username: string;
  displayName: string;
  role: AppRole;
  password: string;
}): Promise<UserResult> {
  await requireProfile({ roles: ["owner"] });
  const username = input.username.trim();
  if (!isValidUsername(username)) return { ok: false, error: "usernameInvalid" };
  const nameError = checkDisplayName(input.displayName);
  if (nameError) return { ok: false, error: nameError };
  if (!isAppRole(input.role)) return { ok: false, error: "roleInvalid" };
  const passwordError = checkPassword(input.password);
  if (passwordError) return { ok: false, error: passwordError };

  try {
    await createAccount(await getDb(), {
      username,
      displayName: input.displayName,
      role: input.role,
      password: input.password,
    });
  } catch (error) {
    if (error instanceof UsernameTakenError) return { ok: false, error: "usernameTaken" };
    console.error("[users]", error);
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function updateUser(input: { id: string; displayName: string; role: AppRole }): Promise<UserResult> {
  const me = await requireProfile({ roles: ["owner"] });
  const nameError = checkDisplayName(input.displayName);
  if (nameError) return { ok: false, error: nameError };
  if (!isAppRole(input.role)) return { ok: false, error: "roleInvalid" };

  const db = await getDb();
  const target = await row<{ id: string; role: AppRole }>(db, "select id, role from public.profiles where id = $1", [
    input.id,
  ]).catch(() => null);
  if (!target) return { ok: false, error: "notFound" };
  if (target.id === me.id && input.role !== me.role) return { ok: false, error: "cannotChangeOwnRole" };
  if (target.role === "owner" && input.role !== "owner" && (await ownerCount(db)) <= 1) {
    return { ok: false, error: "lastOwner" };
  }

  try {
    await db.transaction(async (tx) => {
      await tx.query("update public.profiles set display_name = $2, role = $3 where id = $1", [
        input.id,
        input.displayName.trim(),
        input.role,
      ]);
      // The role is also in the session cookie (read by proxy.ts): a new role means signing in again.
      if (target.role !== input.role) await tx.query("delete from auth.sessions where user_id = $1", [input.id]);
    });
  } catch (error) {
    console.error("[users]", error);
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function resetPassword(input: { id: string; password: string }): Promise<UserResult> {
  await requireProfile({ roles: ["owner"] });
  const passwordError = checkPassword(input.password);
  if (passwordError) return { ok: false, error: passwordError };

  try {
    const db = await getDb();
    const target = await row(db, "select 1 from auth.users where id = $1", [input.id]).catch(() => null);
    if (!target) return { ok: false, error: "notFound" };
    // Also signs that person out on every device.
    await setPassword(db, input.id, input.password);
  } catch (error) {
    console.error("[users]", error);
    return { ok: false, error: "unknown" };
  }
  return { ok: true };
}

export async function deleteUser(input: { id: string }): Promise<UserResult> {
  const me = await requireProfile({ roles: ["owner"] });
  if (input.id === me.id) return { ok: false, error: "cannotDeleteSelf" };

  const db = await getDb();
  const target = await row<{ role: AppRole }>(db, "select role from public.profiles where id = $1", [input.id]).catch(
    () => null,
  );
  if (!target) return { ok: false, error: "notFound" };
  if (target.role === "owner" && (await ownerCount(db)) <= 1) return { ok: false, error: "lastOwner" };

  try {
    // Deleting the login cascades to the profile, sessions, orders and subscriptions.
    await db.query("delete from auth.users where id = $1", [input.id]);
  } catch (error) {
    console.error("[users]", error);
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/admin/users");
  return { ok: true };
}
