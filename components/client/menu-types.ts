import type { Dish, DishIngredient } from "@/lib/types";

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
