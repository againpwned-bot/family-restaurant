import type { DbErrorKey } from "@/lib/errors";

/** What every server action returns (see lib/server/action.ts). */
export type ActionResult<T> = { data: T; error: null } | { data: null; error: { message: DbErrorKey } };

/** Awaits a server action; a dropped connection becomes the "network" error instead of a throw. */
export async function safe<T>(call: Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await call;
  } catch {
    return { data: null, error: { message: "network" } };
  }
}
