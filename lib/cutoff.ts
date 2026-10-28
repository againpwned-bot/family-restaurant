import { kitchenHHMM } from "@/lib/dates";
import type { AppSettings, Meal } from "@/lib/types";

// The time after which a dish can't be ordered today: the earlier of its meal's cut-off and the general one.
export function effectiveCutoff(
  settings: Pick<AppSettings, "cutoff_breakfast" | "cutoff_lunch" | "cutoff_dinner" | "cutoff_all">,
  meal: Meal | null,
): string | null {
  const byMeal = meal ? settings[`cutoff_${meal}`] : null;
  const all = settings.cutoff_all;
  if (byMeal && all) return byMeal < all ? byMeal : all;
  return byMeal ?? all ?? null;
}

export function isPastCutoff(cutoff: string | null, now: Date | number = new Date()): boolean {
  return !!cutoff && kitchenHHMM(new Date(now)) > cutoff;
}
