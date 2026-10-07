// OPTIONAL example dishes, so the menu isn't empty on day one. No photos:
// those you upload yourself from Admin -> Dishes (and you can edit or delete
// these examples there too). Skips any dish whose name already exists.
//
//   npm run seed:dishes            add the examples (the first four go on today's menu)
//   npm run seed:dishes -- --none-today   add them, but leave today's menu empty

import { adminClient, fail } from "./lib/supabase-admin";

type SeedIngredient = [name: string, quantity: number | null, unit: string];
type SeedDish = { name: string; description: string; cookMinutes: number; ingredients: SeedIngredient[] };

// Quantities are per portion; "null" means "după gust" (to taste).
const DISHES: SeedDish[] = [
  {
    name: "Sarmale cu mămăligă",
    description:
      "Sarmale în foi de varză murată, fierte încet cu afumătură și cimbru, servite cu mămăligă caldă și smântână.",
    cookMinutes: 180,
    ingredients: [
      ["Carne tocată de porc", 150, "g"],
      ["Foi de varză murată", 4, "buc"],
      ["Orez", 20, "g"],
      ["Ceapă", 0.25, "buc"],
      ["Afumătură", 40, "g"],
      ["Mălai", 80, "g"],
      ["Smântână", 50, "g"],
      ["Cimbru", null, ""],
    ],
  },
  {
    name: "Ciorbă de perișoare",
    description:
      "Ciorbă acrită cu borș, cu perișoare fragede din carne și orez, legume de grădină și leuștean proaspăt.",
    cookMinutes: 90,
    ingredients: [
      ["Carne tocată de porc", 100, "g"],
      ["Orez", 15, "g"],
      ["Morcov", 0.5, "buc"],
      ["Ceapă", 0.25, "buc"],
      ["Ardei gras", 0.25, "buc"],
      ["Borș", 150, "ml"],
      ["Leuștean", null, ""],
    ],
  },
  {
    name: "Mici cu cartofi prăjiți",
    description: "Mici suculenți la grătar, cu cartofi prăjiți aurii și muștar.",
    cookMinutes: 40,
    ingredients: [
      ["Mici", 4, "buc"],
      ["Cartofi", 300, "g"],
      ["Muștar", 30, "g"],
      ["Ulei", 50, "ml"],
    ],
  },
  {
    name: "Tochitură moldovenească",
    description: "Carne de porc și cârnați rumeniți în vin, cu mămăligă, brânză de burduf și ou ochi.",
    cookMinutes: 60,
    ingredients: [
      ["Ceafă de porc", 150, "g"],
      ["Cârnați", 100, "g"],
      ["Mălai", 80, "g"],
      ["Brânză de burduf", 50, "g"],
      ["Ouă", 1, "buc"],
      ["Usturoi", 2, "căței"],
      ["Vin alb", 50, "ml"],
    ],
  },
  {
    name: "Papanași cu smântână și dulceață",
    description: "Papanași pufoși din brânză de vaci, prăjiți, cu smântână și dulceață de afine.",
    cookMinutes: 40,
    ingredients: [
      ["Brânză de vaci", 125, "g"],
      ["Ouă", 0.5, "buc"],
      ["Făină", 60, "g"],
      ["Zahăr", 15, "g"],
      ["Smântână", 50, "g"],
      ["Dulceață de afine", 40, "g"],
    ],
  },
  {
    name: "Salată de vinete",
    description: "Vinete coapte pe plită, tocate cu ceapă și ulei, servite cu roșii și pâine prăjită.",
    cookMinutes: 45,
    ingredients: [
      ["Vinete", 1, "buc"],
      ["Ceapă", 0.25, "buc"],
      ["Ulei", 30, "ml"],
      ["Roșii", 1, "buc"],
      ["Sare", null, ""],
    ],
  },
];

async function main() {
  const noneToday = process.argv.includes("--none-today");
  const supabase = adminClient();

  const { data: today, error: todayError } = await supabase.rpc("today_local");
  if (todayError || !today) fail(`Could not read today's date from the database: ${todayError?.message}`);

  const { data: owner } = await supabase.from("profiles").select("id").eq("role", "owner").limit(1).maybeSingle();
  const { data: existing } = await supabase.from("dishes").select("name");
  const taken = new Set((existing ?? []).map((d) => d.name.toLowerCase()));

  let added = 0;
  for (const [index, dish] of DISHES.entries()) {
    if (taken.has(dish.name.toLowerCase())) {
      console.log(`· skipped  ${dish.name} (already exists)`);
      continue;
    }
    const { data: row, error } = await supabase
      .from("dishes")
      .insert({
        name: dish.name,
        description: dish.description,
        cook_minutes: dish.cookMinutes,
        available_on: !noneToday && index < 4 ? today : null,
        created_by: owner?.id ?? null,
      })
      .select("id")
      .single();
    if (error || !row) fail(`Could not add ${dish.name}: ${error?.message}`);

    const { error: ingredientsError } = await supabase.from("dish_ingredients").insert(
      dish.ingredients.map(([name, quantity, unit], position) => ({
        dish_id: row.id,
        name,
        quantity,
        unit,
        position,
      })),
    );
    if (ingredientsError) fail(`Could not add the ingredients of ${dish.name}: ${ingredientsError.message}`);
    added++;
    console.log(`✓ added    ${dish.name}`);
  }

  console.log(`\nDone: ${added} dish(es) added.`);
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
