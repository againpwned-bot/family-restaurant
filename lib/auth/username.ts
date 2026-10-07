// People sign in with a username (case-insensitive) and a password.

export const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,32}$/;

export const PASSWORD_MIN_LENGTH = 8;
// Upper bound in bytes, so a huge "password" can't be used to slow the server down.
export const PASSWORD_MAX_LENGTH = 72;

export function normalizeUsername(username: string): string {
  return username.trim();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(normalizeUsername(username));
}
