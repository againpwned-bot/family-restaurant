// Row types for the schema in db/migrations (kept in sync by hand).
// Timestamps arrive as ISO strings and dates as "YYYY-MM-DD" (see lib/server/database.ts).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = "owner" | "admin" | "client";
export type OrderStatus = "received" | "accepted" | "cooking" | "ready" | "handed_over" | "rejected" | "cancelled";
export type NotificationType =
  "order_new" | "order_cancelled" | "order_accepted" | "order_rejected" | "order_ready" | "order_extended" | "test";
export type AnimationPref = "auto" | "full" | "lite" | "reduced";
export type AnimationTier = "full" | "lite" | "reduced";
export type Locale = "ro" | "en";

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  role: AppRole;
  locale: Locale;
  animation_pref: AnimationPref;
  animation_detected: AnimationTier | null;
  created_at: string;
  updated_at: string;
};

export type Dish = {
  id: string;
  name: string;
  description: string;
  photo_path: string | null;
  photo_width: number | null;
  photo_height: number | null;
  photo_blur: string | null;
  cook_minutes: number;
  available_on: string | null;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DishIngredient = {
  id: string;
  dish_id: string;
  position: number;
  name: string;
  quantity: number | null;
  unit: string;
};

export type Order = {
  id: string;
  number: number;
  client_id: string;
  dish_id: string | null;
  dish_name: string;
  dish_photo_path: string | null;
  quantity: number;
  comment: string | null;
  requested_for: string | null;
  status: OrderStatus;
  decided_by: string | null;
  decided_at: string | null;
  reject_reason: string | null;
  timer_minutes: number | null;
  eta_at: string | null;
  cooking_at: string | null;
  ready_at: string | null;
  handed_over_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderEvent = {
  id: number;
  order_id: string;
  actor_id: string | null;
  kind: "created" | "accepted" | "rejected" | "cooking" | "extended" | "ready" | "handed_over" | "cancelled";
  data: Json;
  created_at: string;
};

export type AppNotification = {
  id: string;
  recipient_id: string;
  order_id: string | null;
  type: NotificationType;
  payload: Json;
  read_at: string | null;
  pushed_at: string | null;
  created_at: string;
};

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  failure_count: number;
  last_success_at: string | null;
  created_at: string;
};

export type ShoppingCheck = {
  day: string;
  item_key: string;
  quantity: number | null;
  checked_by: string | null;
  checked_at: string;
};
