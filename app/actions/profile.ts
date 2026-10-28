"use server";

import { revalidatePath } from "next/cache";

import { act } from "@/lib/server/action";
import { changeAvatar, cleanDiet } from "@/lib/server/profile";
import { getSession } from "@/lib/auth/dal";
import { dbErrorKey } from "@/lib/errors";
import type { ActionResult } from "@/lib/action-result";

export async function saveMyDiet(input: { allergies: string; tags: string[] }) {
  const diet = cleanDiet(input);
  const result = await act(null, async (tx, me) => {
    await tx.query("update public.profiles set allergies = $2, diet_tags = $3 where id = $1", [
      me.id,
      diet.allergies,
      diet.tags,
    ]);
    return diet;
  });
  return result;
}

export async function setMyAvatar(form: FormData): Promise<ActionResult<{ path: string | null }>> {
  const session = await getSession();
  if (!session) return { data: null, error: { message: "forbidden" } };
  const file = form.get("avatar");
  try {
    const path = await changeAvatar(
      session.profile.id,
      session.profile.id,
      file instanceof File && file.size > 0 ? file : null,
    );
    revalidatePath("/", "layout");
    return { data: { path }, error: null };
  } catch (error) {
    const key = dbErrorKey(error as { message?: string; code?: string });
    if (key === "unknown") console.error("[avatar]", error);
    return { data: null, error: { message: key } };
  }
}
