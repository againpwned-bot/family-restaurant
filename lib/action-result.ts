import type { DbErrorKey } from "@/lib/errors";

export type ActionResult<T> = { data: T; error: null } | { data: null; error: { message: DbErrorKey } };

export async function safe<T>(call: Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await call;
  } catch {
    return { data: null, error: { message: "network" } };
  }
}
