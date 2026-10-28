import { getTranslations } from "next-intl/server";

import { getSession } from "@/lib/auth/dal";
import { isStaff } from "@/lib/auth/roles";
import { csvResponse, toCsv } from "@/lib/csv";
import { kitchenDate } from "@/lib/dates";
import { asUser } from "@/lib/server/db";
import { shoppingData } from "@/lib/server/queries";
import { buildShoppingList, displayQuantity } from "@/lib/shopping";

export async function GET() {
  const session = await getSession();
  if (!session || !isStaff(session.profile.role)) return new Response("Forbidden", { status: 403 });
  const t = await getTranslations();
  const today = kitchenDate();
  const data = await asUser(session.profile.id, (tx) => shoppingData(tx, today));
  const checked = new Set(data.checks.map((c) => c.item_key));
  const items = buildShoppingList(data.orders, data.ingredients);

  const body = toCsv([
    ["item", "quantity", "unit", "dishes", "bought"].map((key) => t(`export.shopping.${key}` as Parameters<typeof t>[0])),
    ...items.map((item) => {
      const amount = item.total !== null ? displayQuantity(item.total, item.unit) : null;
      return [
        item.name,
        amount?.value ?? (item.toTaste ? t("adminShopping.toTaste") : null),
        amount?.unit ?? item.unit,
        item.dishes.map((d) => `${d.name} ×${d.quantity}`).join("; "),
        checked.has(item.key) ? t("common.yes") : t("common.no"),
      ];
    }),
  ]);
  return csvResponse(body, `shopping-${today}.csv`);
}
