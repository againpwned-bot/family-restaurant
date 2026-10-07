"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { LOCALE_COOKIE, resolveLocale } from "@/i18n/config";
import { getCurrentProfile } from "@/lib/auth/dal";
import { asUser } from "@/lib/server/db";
import { THEME_COOKIE, resolveTheme } from "@/lib/theme";
import type { AnimationPref, AnimationTier } from "@/lib/types";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setLocale(value: string) {
  const locale = resolveLocale(value);
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });

  // Also remember it on the account, so it follows the user to other devices.
  const profile = await getCurrentProfile();
  if (profile && profile.locale !== locale) {
    await asUser(profile.id, (tx) => tx.query("update public.profiles set locale = $2 where id = $1", [profile.id, locale]));
  }
  revalidatePath("/", "layout");
}

export async function setTheme(value: string) {
  const theme = resolveTheme(value);
  const store = await cookies();
  store.set(THEME_COOKIE, theme, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}

const PREFS: AnimationPref[] = ["auto", "full", "lite", "reduced"];
const TIERS: AnimationTier[] = ["full", "lite", "reduced"];

/** The user's animation choice, remembered on the account (Settings -> Animations). */
export async function setAnimationPref(value: AnimationPref) {
  const profile = await getCurrentProfile();
  if (!profile || !PREFS.includes(value)) return;
  await asUser(profile.id, (tx) =>
    tx.query("update public.profiles set animation_pref = $2 where id = $1", [profile.id, value]),
  );
}

/** What the device detection settled on (shown next to "Auto" in Settings). */
export async function setAnimationDetected(value: AnimationTier) {
  const profile = await getCurrentProfile();
  if (!profile || !TIERS.includes(value)) return;
  await asUser(profile.id, (tx) =>
    tx.query("update public.profiles set animation_detected = $2 where id = $1", [profile.id, value]),
  );
}
