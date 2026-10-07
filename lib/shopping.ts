// Shopping list maths: per-portion ingredient quantities x ordered quantity,
// summed across all accepted / cooking orders. Units are normalised so that
// "500 g" + "1 kg" adds up to 1.5 kg.

export type UnitInfo = { unit: string; factor: number };

// Canonical unit + factor to the base unit. Keys are lower-case, trimmed.
const UNITS: Record<string, UnitInfo> = {
  g: { unit: "g", factor: 1 },
  gr: { unit: "g", factor: 1 },
  gram: { unit: "g", factor: 1 },
  grame: { unit: "g", factor: 1 },
  kg: { unit: "g", factor: 1000 },
  kilogram: { unit: "g", factor: 1000 },
  kilograme: { unit: "g", factor: 1000 },
  ml: { unit: "ml", factor: 1 },
  dl: { unit: "ml", factor: 100 },
  l: { unit: "ml", factor: 1000 },
  litru: { unit: "ml", factor: 1000 },
  litri: { unit: "ml", factor: 1000 },
  buc: { unit: "buc", factor: 1 },
  "buc.": { unit: "buc", factor: 1 },
  bucata: { unit: "buc", factor: 1 },
  bucată: { unit: "buc", factor: 1 },
  bucati: { unit: "buc", factor: 1 },
  bucăți: { unit: "buc", factor: 1 },
  lingura: { unit: "lingură", factor: 1 },
  lingură: { unit: "lingură", factor: 1 },
  linguri: { unit: "lingură", factor: 1 },
  lingurita: { unit: "linguriță", factor: 1 },
  linguriță: { unit: "linguriță", factor: 1 },
  lingurite: { unit: "linguriță", factor: 1 },
  lingurițe: { unit: "linguriță", factor: 1 },
  cana: { unit: "cană", factor: 1 },
  cană: { unit: "cană", factor: 1 },
  cani: { unit: "cană", factor: 1 },
  căni: { unit: "cană", factor: 1 },
  catel: { unit: "cățel", factor: 1 },
  cățel: { unit: "cățel", factor: 1 },
  catei: { unit: "cățel", factor: 1 },
  căței: { unit: "cățel", factor: 1 },
  legatura: { unit: "legătură", factor: 1 },
  legătură: { unit: "legătură", factor: 1 },
  legaturi: { unit: "legătură", factor: 1 },
  legături: { unit: "legătură", factor: 1 },
  // English spellings (the app can be used in English too).
  pc: { unit: "buc", factor: 1 },
  pcs: { unit: "buc", factor: 1 },
  tbsp: { unit: "lingură", factor: 1 },
  tsp: { unit: "linguriță", factor: 1 },
  cup: { unit: "cană", factor: 1 },
  cups: { unit: "cană", factor: 1 },
  clove: { unit: "cățel", factor: 1 },
  cloves: { unit: "cățel", factor: 1 },
  bunch: { unit: "legătură", factor: 1 },
};

// Romanian plural of the canonical units (these are data words typed by the
// cook, shown next to numbers; "g", "ml", "buc" don't change).
const PLURAL: Record<string, string> = {
  lingură: "linguri",
  linguriță: "lingurițe",
  cană: "căni",
  cățel: "căței",
  legătură: "legături",
};

export function normalizeUnit(raw: string): UnitInfo {
  const key = raw.trim().toLocaleLowerCase("ro");
  return UNITS[key] ?? { unit: key, factor: 1 };
}

export function itemKey(name: string, unit: string): string {
  return `${name.trim().toLocaleLowerCase("ro").replace(/\s+/g, " ")}|${normalizeUnit(unit).unit}`;
}

export type ShoppingOrder = { dish_id: string | null; dish_name: string; quantity: number };
export type ShoppingIngredient = { dish_id: string; name: string; quantity: number | null; unit: string };

export type ShoppingItem = {
  key: string;
  name: string;
  /** Canonical unit ("g", "ml", "buc", "lingură", ...) or "" */
  unit: string;
  /** Total in the base unit, or null when only "to taste" amounts were listed. */
  total: number | null;
  toTaste: boolean;
  dishes: { name: string; quantity: number }[];
};

export function buildShoppingList(orders: ShoppingOrder[], ingredients: ShoppingIngredient[]): ShoppingItem[] {
  const byDish = new Map<string, ShoppingIngredient[]>();
  for (const ing of ingredients) {
    if (!byDish.has(ing.dish_id)) byDish.set(ing.dish_id, []);
    byDish.get(ing.dish_id)!.push(ing);
  }

  const items = new Map<string, ShoppingItem>();
  for (const order of orders) {
    if (!order.dish_id) continue;
    for (const ing of byDish.get(order.dish_id) ?? []) {
      const { unit, factor } = normalizeUnit(ing.unit);
      const key = itemKey(ing.name, ing.unit);
      let item = items.get(key);
      if (!item) {
        item = { key, name: ing.name.trim(), unit, total: null, toTaste: false, dishes: [] };
        items.set(key, item);
      }
      if (ing.quantity === null || ing.quantity === undefined) item.toTaste = true;
      else item.total = (item.total ?? 0) + Number(ing.quantity) * factor * order.quantity;
      const dish = item.dishes.find((d) => d.name === order.dish_name);
      if (dish) dish.quantity += order.quantity;
      else item.dishes.push({ name: order.dish_name, quantity: order.quantity });
    }
  }
  return [...items.values()].sort((a, b) => a.name.localeCompare(b.name, "ro"));
}

/** Display form: 1500 g -> { value: 1.5, unit: "kg" }, 3 lingură -> "linguri". */
export function displayQuantity(total: number, unit: string): { value: number; unit: string } {
  const round = (n: number) => Math.round(n * 100) / 100;
  if (unit === "g" && total >= 1000) return { value: round(total / 1000), unit: "kg" };
  if (unit === "ml" && total >= 1000) return { value: round(total / 1000), unit: "l" };
  const value = round(total);
  return { value, unit: value !== 1 && PLURAL[unit] ? PLURAL[unit] : unit };
}

export function formatQuantity(total: number, unit: string, locale: string): string {
  const { value, unit: u } = displayQuantity(total, unit);
  const number = new Intl.NumberFormat(locale === "ro" ? "ro-RO" : "en-GB", { maximumFractionDigits: 2 }).format(value);
  return u ? `${number} ${u}` : number;
}
