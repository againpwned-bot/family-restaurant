export type ThemePref = "system" | "light" | "dark";

export const THEME_COOKIE = "theme";
export const THEMES: readonly ThemePref[] = ["system", "light", "dark"];

export function resolveTheme(value: string | null | undefined): ThemePref {
  return (THEMES as readonly string[]).includes(value ?? "") ? (value as ThemePref) : "system";
}
