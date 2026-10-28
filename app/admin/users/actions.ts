"use server";

import { revalidatePath } from "next/cache";

import { requireProfile } from "@/lib/auth/dal";
import { isAppRole } from "@/lib/auth/roles";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, isValidUsername } from "@/lib/auth/username";
import { UsernameTakenError, createAccount, setPassword } from "@/lib/server/accounts";
import { row, type Queryable } from "@/lib/server/database";
import { asActor, audit, getDb } from "@/lib/server/db";
import { changeAvatar, cleanDiet } from "@/lib/server/profile";
import { deleteAvatar } from "@/lib/server/uploads";
import type { AppRole } from "@/lib/types";

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
  | "cannotDisableSelf"
  | "invalidPhoto"
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
  return (
    (await row<{ n: number }>(
      db,
      "select count(*)::int as n from public.profiles where role = 'owner' and disabled_at is null",
    ))?.n ?? 0
  );
}

export async function createUser(input: {
  username: string;
  displayName: string;
  role: AppRole;
  password: string;
}): Promise<UserResult> {
  const me = await requireProfile({ roles: ["owner"] });
  const username = input.username.trim();
  if (!isValidUsername(username)) return { ok: false, error: "usernameInvalid" };
  const nameError = checkDisplayName(input.displayName);
  if (nameError) return { ok: false, error: nameError };
  if (!isAppRole(input.role)) return { ok: false, error: "roleInvalid" };
  const passwordError = checkPassword(input.password);
  if (passwordError) return { ok: false, error: passwordError };

  try {
    await createAccount(
      await getDb(),
      { username, displayName: input.displayName, role: input.role, password: input.password },
      me.id,
    );
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
    await asActor(me.id, async (tx) => {
      await tx.query("update public.profiles set display_name = $2, role = $3 where id = $1", [
        input.id,
        input.displayName.trim(),
        input.role,
      ]);
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
  const me = await requireProfile({ roles: ["owner"] });
  const passwordError = checkPassword(input.password);
  if (passwordError) return { ok: false, error: passwordError };

  try {
    const db = await getDb();
    const target = await row<{ display_name: string }>(
      db,
      "select display_name from public.profiles where id = $1",
      [input.id],
    ).catch(() => null);
    if (!target) return { ok: false, error: "notFound" };
    await setPassword(db, input.id, input.password);
    await asActor(me.id, (tx) =>
      audit(tx, { actorId: me.id, action: "password_reset", entity: "user", entityId: input.id, label: target.display_name }),
    );
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
  const target = await row<{ role: AppRole; avatar_path: string | null; disabled_at: string | null }>(
    db,
    "select role, avatar_path, disabled_at from public.profiles where id = $1",
    [input.id],
  ).catch(() => null);
  if (!target) return { ok: false, error: "notFound" };
  if (target.role === "owner" && !target.disabled_at && (await ownerCount(db)) <= 1) {
    return { ok: false, error: "lastOwner" };
  }

  try {
    await asActor(me.id, (tx) => tx.query("delete from auth.users where id = $1", [input.id]));
    await deleteAvatar(target.avatar_path);
  } catch (error) {
    console.error("[users]", error);
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserDisabled(input: { id: string; disabled: boolean }): Promise<UserResult> {
  const me = await requireProfile({ roles: ["owner"] });
  if (input.id === me.id) return { ok: false, error: "cannotDisableSelf" };

  const db = await getDb();
  const target = await row<{ role: AppRole; disabled_at: string | null }>(
    db,
    "select role, disabled_at from public.profiles where id = $1",
    [input.id],
  ).catch(() => null);
  if (!target) return { ok: false, error: "notFound" };
  if (input.disabled && target.role === "owner" && !target.disabled_at && (await ownerCount(db)) <= 1) {
    return { ok: false, error: "lastOwner" };
  }

  try {
    await asActor(me.id, async (tx) => {
      await tx.query("update public.profiles set disabled_at = $2 where id = $1", [
        input.id,
        input.disabled ? new Date().toISOString() : null,
      ]);
      if (input.disabled) {
        await tx.query("delete from auth.sessions where user_id = $1", [input.id]);
        await tx.query("delete from public.push_subscriptions where user_id = $1", [input.id]);
      }
    });
  } catch (error) {
    console.error("[users]", error);
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserDiet(input: { id: string; allergies: string; tags: string[] }): Promise<UserResult> {
  const me = await requireProfile({ roles: ["owner"] });
  const diet = cleanDiet(input);
  try {
    const result = await asActor(me.id, (tx) =>
      tx.query("update public.profiles set allergies = $2, diet_tags = $3 where id = $1", [
        input.id,
        diet.allergies,
        diet.tags,
      ]),
    );
    if (!result.affectedRows) return { ok: false, error: "notFound" };
  } catch (error) {
    console.error("[users]", error);
    return { ok: false, error: "unknown" };
  }
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserAvatar(form: FormData): Promise<UserResult> {
  const me = await requireProfile({ roles: ["owner"] });
  const id = String(form.get("id") ?? "");
  const file = form.get("avatar");
  try {
    await changeAvatar(me.id, id, file instanceof File && file.size > 0 ? file : null);
  } catch (error) {
    const message = (error as Error).message;
    if (message === "invalid_photo") return { ok: false, error: "invalidPhoto" };
    if (message === "user_not_found") return { ok: false, error: "notFound" };
    console.error("[users]", error);
    return { ok: false, error: "unknown" };
  }
  revalidatePath("/admin/users");
  revalidatePath("/", "layout");
  return { ok: true };
}
