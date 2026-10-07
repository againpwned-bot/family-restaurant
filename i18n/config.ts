import type { Locale } from "@/lib/types";

export const LOCALES: readonly Locale[] = ["ro", "en"];
export const DEFAULT_LOCALE: Locale = "ro";
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const TIME_ZONE = "Europe/Bucharest";

export function resolveLocale(value: string | null | undefined): Locale {
  return (LOCALES as readonly string[]).includes(value ?? "") ? (value as Locale) : DEFAULT_LOCALE;
}
