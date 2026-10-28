import "server-only";

import type { ActionResult } from "@/lib/action-result";
import { getSession } from "@/lib/auth/dal";
import { asUser } from "@/lib/server/db";
import type { Tx } from "@/lib/server/database";
import { dbErrorKey } from "@/lib/errors";
import type { AppRole, Profile } from "@/lib/types";

export async function act<T>(
  roles: readonly AppRole[] | null,
  fn: (tx: Tx, profile: Profile) => Promise<T>,
): Promise<ActionResult<T>> {
  const session = await getSession();
  if (!session || (roles && !roles.includes(session.profile.role))) {
    return { data: null, error: { message: "forbidden" } };
  }
  try {
    return { data: await asUser(session.profile.id, (tx) => fn(tx, session.profile)), error: null };
  } catch (error) {
    const key = dbErrorKey(error as { message?: string; code?: string });
    if (key === "unknown") console.error("[action]", error);
    return { data: null, error: { message: key } };
  }
}
