import "server-only";

import { row } from "@/lib/server/database";
import { asUser } from "@/lib/server/db";
import { deleteAvatar, saveAvatar } from "@/lib/server/uploads";
import { DIET_TAGS, type DietTag } from "@/lib/types";

export function cleanDiet(input: { allergies: string; tags: string[] }): { allergies: string; tags: DietTag[] } {
  return {
    allergies: String(input.allergies ?? "").trim().slice(0, 300),
    tags: [...new Set(input.tags)].filter((t): t is DietTag => (DIET_TAGS as readonly string[]).includes(t)),
  };
}

// Saves (or, with no file, removes) a profile picture. Only the owner may change someone else's.
export async function changeAvatar(actorId: string, targetId: string, file: File | null): Promise<string | null> {
  const saved = file ? await saveAvatar(file) : null;
  let old: string | null;
  try {
    old =
      (await asUser(actorId, (tx) =>
        row<{ old: string | null }>(tx, "select public.set_avatar($1, $2) as old", [targetId, saved]),
      ))?.old ?? null;
  } catch (error) {
    await deleteAvatar(saved);
    throw error;
  }
  if (old && old !== saved) await deleteAvatar(old);
  return saved;
}
