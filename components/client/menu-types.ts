import type { Dish, DishIngredient } from "@/lib/supabase/database.types";

export type MenuDish = Pick<
  Dish,
  | "id"
  | "name"
  | "description"
  | "photo_path"
  | "photo_blur"
  | "photo_width"
  | "photo_height"
  | "cook_minutes"
  | "available_on"
> & { dish_ingredients: Pick<DishIngredient, "name" | "quantity" | "unit" | "position">[] };

export const MENU_SELECT =
  "id, name, description, photo_path, photo_blur, photo_width, photo_height, cook_minutes, available_on, dish_ingredients(name, quantity, unit, position)";
