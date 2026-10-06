// Supabase Auth needs an email, but people here only ever see and type a
// username. Internally `Username` becomes `username@meniu.local`: a fake,
// never-verified address on a reserved TLD that can't receive mail.

export const LOGIN_EMAIL_DOMAIN = "meniu.local";

export const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,32}$/;

export const PASSWORD_MIN_LENGTH = 8;
// bcrypt (used by Supabase Auth) ignores everything after 72 bytes.
export const PASSWORD_MAX_LENGTH = 72;

export function normalizeUsername(username: string): string {
  return username.trim();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(normalizeUsername(username));
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username).toLowerCase()}@${LOGIN_EMAIL_DOMAIN}`;
}
