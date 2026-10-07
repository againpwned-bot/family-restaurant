"use server";

import { revalidatePath } from "next/cache";

import { requireProfile } from "@/lib/auth/dal";
import { isAppRole } from "@/lib/auth/roles";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, isValidUsername, usernameToEmail } from "@/lib/auth/username";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AppRole } from "@/lib/supabase/database.types";

// Owner-only user management. Every action re-checks the caller's role from
// the database before touching the service-role client.

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

async function ownerCount(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "owner");
  return count ?? 0;
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

  const admin = createSupabaseAdminClient();
  const { data: taken } = await admin.from("profiles").select("id").ilike("username", username).maybeSingle();
  if (taken) return { ok: false, error: "usernameTaken" };

  const { data, error } = await admin.auth.admin.createUser({
    email: usernameToEmail(username),
    password: input.password,
    email_confirm: true,
    app_metadata: { role: input.role },
    user_metadata: { username },
  });
  if (error || !data.user) {
    return { ok: false, error: error?.code === "email_exists" ? "usernameTaken" : "unknown" };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    username,
    display_name: input.displayName.trim(),
    role: input.role,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, error: profileError.code === "23505" ? "usernameTaken" : "unknown" };
  }

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function updateUser(input: { id: string; displayName: string; role: AppRole }): Promise<UserResult> {
  const me = await requireProfile({ roles: ["owner"] });
  const nameError = checkDisplayName(input.displayName);
  if (nameError) return { ok: false, error: nameError };
  if (!isAppRole(input.role)) return { ok: false, error: "roleInvalid" };

  const admin = createSupabaseAdminClient();
  const { data: target } = await admin.from("profiles").select("id, role").eq("id", input.id).maybeSingle();
  if (!target) return { ok: false, error: "notFound" };
  if (target.id === me.id && input.role !== me.role) return { ok: false, error: "cannotChangeOwnRole" };
  if (target.role === "owner" && input.role !== "owner" && (await ownerCount(admin)) <= 1) {
    return { ok: false, error: "lastOwner" };
  }

  const { error } = await admin
    .from("profiles")
    .update({ display_name: input.displayName.trim(), role: input.role })
    .eq("id", input.id);
  if (error) return { ok: false, error: "unknown" };
  if (target.role !== input.role) {
    // Keep the role claim in the JWT in sync (read by proxy.ts).
    await admin.auth.admin.updateUserById(input.id, { app_metadata: { role: input.role } });
  }

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function resetPassword(input: { id: string; password: string }): Promise<UserResult> {
  await requireProfile({ roles: ["owner"] });
  const passwordError = checkPassword(input.password);
  if (passwordError) return { ok: false, error: passwordError };

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.updateUserById(input.id, { password: input.password });
  if (error) return { ok: false, error: error.status === 404 ? "notFound" : "unknown" };
  return { ok: true };
}

export async function deleteUser(input: { id: string }): Promise<UserResult> {
  const me = await requireProfile({ roles: ["owner"] });
  if (input.id === me.id) return { ok: false, error: "cannotDeleteSelf" };

  const admin = createSupabaseAdminClient();
  const { data: target } = await admin.from("profiles").select("role").eq("id", input.id).maybeSingle();
  if (target?.role === "owner" && (await ownerCount(admin)) <= 1) return { ok: false, error: "lastOwner" };

  // Deleting the auth user cascades to the profile, orders and subscriptions.
  const { error } = await admin.auth.admin.deleteUser(input.id);
  if (error) return { ok: false, error: error.status === 404 ? "notFound" : "unknown" };

  revalidatePath("/admin/users");
  return { ok: true };
}
