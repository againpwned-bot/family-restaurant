"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { LOCALE_COOKIE, resolveLocale } from "@/i18n/config";
import { getCurrentProfile } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { THEME_COOKIE, resolveTheme } from "@/lib/theme";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setLocale(value: string) {
  const locale = resolveLocale(value);
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });

  // Also remember it on the account, so it follows the user to other devices.
  const profile = await getCurrentProfile();
  if (profile && profile.locale !== locale) {
    const supabase = await createSupabaseServerClient();
    await supabase.from("profiles").update({ locale }).eq("id", profile.id);
  }
  revalidatePath("/", "layout");
}

export async function setTheme(value: string) {
  const theme = resolveTheme(value);
  const store = await cookies();
  store.set(THEME_COOKIE, theme, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}
