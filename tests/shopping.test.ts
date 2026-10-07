import assert from "node:assert/strict";
import { test } from "node:test";

import { kitchenDate, kitchenDayStart, kitchenTimeToday } from "../lib/dates";
import { buildShoppingList, formatQuantity, itemKey, normalizeUnit } from "../lib/shopping";

test("units are normalised to a base unit", () => {
  assert.deepEqual(normalizeUnit(" KG "), { unit: "g", factor: 1000 });
  assert.deepEqual(normalizeUnit("linguri"), { unit: "lingură", factor: 1 });
  assert.deepEqual(normalizeUnit("pumn"), { unit: "pumn", factor: 1 });
  assert.equal(itemKey("  Carne  Tocată ", "kg"), itemKey("carne tocată", "g"));
});

test("quantities are multiplied by portions and summed across orders", () => {
  const list = buildShoppingList(
    [
      { dish_id: "a", dish_name: "Sarmale", quantity: 2 },
      { dish_id: "b", dish_name: "Ciorbă", quantity: 1 },
      { dish_id: "a", dish_name: "Sarmale", quantity: 1 },
      { dish_id: null, dish_name: "Șters", quantity: 5 },
    ],
    [
      { dish_id: "a", name: "Carne tocată", quantity: 150, unit: "g" },
      { dish_id: "b", name: "carne tocată", quantity: 0.1, unit: "kg" },
      { dish_id: "a", name: "Cimbru", quantity: null, unit: "" },
      { dish_id: "b", name: "Borș", quantity: 150, unit: "ml" },
    ],
  );
  const meat = list.find((i) => i.key === "carne tocată|g")!;
  assert.equal(meat.total, 550);
  assert.deepEqual(meat.dishes, [
    { name: "Sarmale", quantity: 3 },
    { name: "Ciorbă", quantity: 1 },
  ]);
  const thyme = list.find((i) => i.name === "Cimbru")!;
  assert.equal(thyme.total, null);
  assert.equal(thyme.toTaste, true);
  assert.deepEqual(
    list.map((i) => i.name),
    ["Borș", "Carne tocată", "Cimbru"],
  );
});

test("display quantities switch to kg / l and use the locale's decimal separator", () => {
  assert.equal(formatQuantity(1500, "g", "ro"), "1,5 kg");
  assert.equal(formatQuantity(1500, "g", "en"), "1.5 kg");
  assert.equal(formatQuantity(250, "ml", "ro"), "250 ml");
  assert.equal(formatQuantity(3, "lingură", "ro"), "3 linguri");
  assert.equal(formatQuantity(1, "lingură", "ro"), "1 lingură");
  assert.equal(formatQuantity(0.75, "buc", "ro"), "0,75 buc");
});

test("kitchen day boundaries follow Europe/Bucharest, including DST", () => {
  // 2026-10-06 21:30 UTC is already 00:30 on the 7th in Bucharest (UTC+3).
  assert.equal(kitchenDate(new Date("2026-10-06T21:30:00Z")), "2026-10-07");
  assert.equal(kitchenDayStart(new Date("2026-10-07T10:00:00Z")).toISOString(), "2026-10-06T21:00:00.000Z");
  // Winter time (UTC+2).
  assert.equal(kitchenDayStart(new Date("2026-12-01T10:00:00Z")).toISOString(), "2026-11-30T22:00:00.000Z");
  // DST ends on 2026-10-25 at 04:00 local: midnight is still UTC+3, 13:30 is UTC+2.
  assert.equal(kitchenTimeToday("13:30", new Date("2026-10-25T09:00:00Z"))!.toISOString(), "2026-10-25T11:30:00.000Z");
  assert.equal(kitchenTimeToday("25:99"), null);
});
