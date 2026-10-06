// Types for the schema in supabase/migrations. Written by hand to match the SQL
// (regenerate with `npx supabase gen types typescript --linked` once the
// project is linked, and keep the helper aliases at the bottom).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = "owner" | "admin" | "client";
export type OrderStatus = "received" | "accepted" | "cooking" | "ready" | "handed_over" | "rejected" | "cancelled";
export type NotificationType =
  "order_new" | "order_cancelled" | "order_accepted" | "order_rejected" | "order_ready" | "order_extended";
export type AnimationPref = "auto" | "full" | "lite" | "reduced";
export type AnimationTier = "full" | "lite" | "reduced";
export type Locale = "ro" | "en";

type OrderRow = {
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

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
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
        Insert: {
          id: string;
          username: string;
          display_name: string;
          role?: AppRole;
          locale?: Locale;
          animation_pref?: AnimationPref;
          animation_detected?: AnimationTier | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string;
          locale?: Locale;
          animation_pref?: AnimationPref;
          animation_detected?: AnimationTier | null;
          username?: string;
          role?: AppRole;
        };
        Relationships: [];
      };
      dishes: {
        Row: {
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
        Insert: {
          id?: string;
          name: string;
          description?: string;
          photo_path?: string | null;
          photo_width?: number | null;
          photo_height?: number | null;
          photo_blur?: string | null;
          cook_minutes?: number;
          available_on?: string | null;
          archived_at?: string | null;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          description?: string;
          photo_path?: string | null;
          photo_width?: number | null;
          photo_height?: number | null;
          photo_blur?: string | null;
          cook_minutes?: number;
          available_on?: string | null;
          archived_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "dishes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      dish_ingredients: {
        Row: {
          id: string;
          dish_id: string;
          position: number;
          name: string;
          quantity: number | null;
          unit: string;
        };
        Insert: {
          id?: string;
          dish_id: string;
          position?: number;
          name: string;
          quantity?: number | null;
          unit?: string;
        };
        Update: {
          position?: number;
          name?: string;
          quantity?: number | null;
          unit?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dish_ingredients_dish_id_fkey";
            columns: ["dish_id"];
            isOneToOne: false;
            referencedRelation: "dishes";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: OrderRow;
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_decided_by_fkey";
            columns: ["decided_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_dish_id_fkey";
            columns: ["dish_id"];
            isOneToOne: false;
            referencedRelation: "dishes";
            referencedColumns: ["id"];
          },
        ];
      };
      order_events: {
        Row: {
          id: number;
          order_id: string;
          actor_id: string | null;
          kind: "created" | "accepted" | "rejected" | "cooking" | "extended" | "ready" | "handed_over" | "cancelled";
          data: Json;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          order_id: string | null;
          type: NotificationType;
          payload: Json;
          read_at: string | null;
          pushed_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: {
          read_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      push_subscriptions: {
        Row: {
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
        Insert: never;
        Update: never;
        Relationships: [];
      };
      shopping_checks: {
        Row: {
          day: string;
          item_key: string;
          quantity: number | null;
          checked_by: string | null;
          checked_at: string;
        };
        Insert: {
          day?: string;
          item_key: string;
          quantity?: number | null;
          checked_by?: string | null;
          checked_at?: string;
        };
        Update: {
          quantity?: number | null;
          checked_by?: string | null;
          checked_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      today_local: { Args: never; Returns: string };
      current_app_role: { Args: never; Returns: AppRole };
      is_staff: { Args: never; Returns: boolean };
      is_owner: { Args: never; Returns: boolean };
      place_order: {
        Args: {
          p_dish_id: string;
          p_quantity?: number;
          p_comment?: string | null;
          p_requested_for?: string | null;
        };
        Returns: OrderRow;
      };
      cancel_order: { Args: { p_order_id: string }; Returns: OrderRow };
      accept_order: { Args: { p_order_id: string; p_minutes: number }; Returns: OrderRow };
      reject_order: { Args: { p_order_id: string; p_reason?: string | null }; Returns: OrderRow };
      start_cooking: { Args: { p_order_id: string }; Returns: OrderRow };
      extend_order_timer: { Args: { p_order_id: string; p_minutes: number }; Returns: OrderRow };
      mark_order_ready: { Args: { p_order_id: string }; Returns: OrderRow };
      hand_over_order: { Args: { p_order_id: string }; Returns: OrderRow };
      register_push_subscription: {
        Args: { p_endpoint: string; p_p256dh: string; p_auth: string; p_user_agent?: string | null };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: AppRole;
      order_status: OrderStatus;
      notification_type: NotificationType;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicTables = Database["public"]["Tables"];
export type Tables<T extends keyof PublicTables> = PublicTables[T]["Row"];

export type Profile = Tables<"profiles">;
export type Dish = Tables<"dishes">;
export type DishIngredient = Tables<"dish_ingredients">;
export type Order = Tables<"orders">;
export type OrderEvent = Tables<"order_events">;
export type AppNotification = Tables<"notifications">;
export type ShoppingCheck = Tables<"shopping_checks">;
