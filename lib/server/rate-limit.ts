// In-memory limit for wrong passwords: after 8 failures in 10 minutes for the
// same username + address, further attempts are refused until the window ends.
// Callers can also cap a username across all addresses (addresses come from
// headers a client can set, so they alone don't stop guessing).

const WINDOW_MS = 10 * 60 * 1000;
export const MAX_FAILURES = 8;

const store = globalThis as typeof globalThis & { __meniuLoginFailures?: Map<string, number[]> };
const failures = (store.__meniuLoginFailures ??= new Map<string, number[]>());

function recent(key: string, now: number) {
  const list = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length) failures.set(key, list);
  else failures.delete(key);
  return list;
}

export function isRateLimited(key: string, max = MAX_FAILURES, now = Date.now()): boolean {
  return recent(key, now).length >= max;
}

export function recordFailure(key: string, now = Date.now()) {
  failures.set(key, [...recent(key, now), now]);
}

export function clearFailures(key: string) {
  failures.delete(key);
}
