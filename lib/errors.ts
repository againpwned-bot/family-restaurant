// Database functions raise exceptions whose message is a stable key
// ("dish_unavailable"); this maps them to translation keys under errors.db.

export const DB_ERROR_KEYS = [
  "forbidden",
  "dish_not_found",
  "dish_unavailable",
  "invalid_quantity",
  "comment_too_long",
  "invalid_requested_time",
  "too_many_open_orders",
  "order_not_found",
  "cannot_cancel",
  "invalid_transition",
  "invalid_minutes",
  "reason_too_long",
  "invalid_ingredients",
  "too_many_ingredients",
  "invalid_item",
  "invalid_photo",
  "network",
  "unknown",
] as const;

export type DbErrorKey = (typeof DB_ERROR_KEYS)[number];

export function dbErrorKey(error: { message?: string; code?: string } | null | undefined): DbErrorKey {
  if (!error) return "unknown";
  const message = error.message ?? "";
  if ((DB_ERROR_KEYS as readonly string[]).includes(message)) return message as DbErrorKey;
  if (/fetch|network|Failed to fetch|NetworkError/i.test(message)) return "network";
  if (error.code === "42501" || /row-level security|permission denied/i.test(message)) return "forbidden";
  return "unknown";
}
