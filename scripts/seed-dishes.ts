import path from "node:path";

import { dataDir, lockDataDir, openDatabase, row, rows } from "../lib/server/database";
import { FAMILY_RECIPES, type SeedDish } from "./family-recipes";

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const EXAMPLES: SeedDish[] = [
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
  const family = process.argv.includes("--family");
  const dishes = family ? FAMILY_RECIPES : EXAMPLES;
  const dir = dataDir();
  lockDataDir(dir);
  const db = await openDatabase(path.join(dir, "db"), (m) => console.log(`· ${m}`));

  const today = (await row<{ day: string }>(db, "select public.today_local() as day"))!.day;
  const owner = await row<{ id: string }>(db, "select id from public.profiles where role = 'owner' limit 1");
  const taken = new Set(
    (await rows<{ name: string }>(db, "select name from public.dishes where archived_at is null")).map((d) =>
      d.name.toLowerCase(),
    ),
  );

  let added = 0;
  for (const [index, dish] of dishes.entries()) {
    if (taken.has(dish.name.toLowerCase())) {
      console.log(`· skipped  ${dish.name} (already exists)`);
      continue;
    }
    await db.transaction(async (tx) => {
      const inserted = await row<{ id: string }>(
        tx,
        `insert into public.dishes (name, description, cook_minutes, available_on, created_by)
         values ($1, $2, $3, $4, $5) returning id`,
        [
          dish.name,
          dish.description,
          dish.cookMinutes,
          !noneToday && !family && index < 4 ? today : null,
          owner?.id ?? null,
        ],
      );
      for (const [position, [name, quantity, unit]] of dish.ingredients.entries()) {
        await tx.query(
          "insert into public.dish_ingredients (dish_id, name, quantity, unit, position) values ($1, $2, $3, $4, $5)",
          [inserted!.id, name, quantity, unit, position],
        );
      }
    });
    added++;
    console.log(`✓ added    ${dish.name}`);
  }

  await db.close();
  console.log(`\nDone: ${added} dish(es) added.`);
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
