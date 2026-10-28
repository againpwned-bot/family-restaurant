"use server";

import { revalidatePath } from "next/cache";

import { act } from "@/lib/server/action";
import { appSettings } from "@/lib/server/queries";

const STAFF = ["owner", "admin"] as const;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export type KitchenSettingsInput = {
  requirePush: boolean;
  cutoffBreakfast: string | null;
  cutoffLunch: string | null;
  cutoffDinner: string | null;
  cutoffAll: string | null;
};

const time = (value: string | null) => (value && HHMM.test(value) ? value : null);

export async function saveKitchenSettings(input: KitchenSettingsInput) {
  const result = await act(STAFF, async (tx) => {
    await tx.query("select public.save_app_settings($1, $2::time, $3::time, $4::time, $5::time)", [
      !!input.requirePush,
      time(input.cutoffBreakfast),
      time(input.cutoffLunch),
      time(input.cutoffDinner),
      time(input.cutoffAll),
    ]);
    return appSettings(tx);
  });
  if (!result.error) revalidatePath("/", "layout");
  return result;
}
