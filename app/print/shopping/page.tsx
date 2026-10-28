import { getTranslations } from "next-intl/server";

import { PrintControls } from "@/components/print/print-controls";
import { requireProfile } from "@/lib/auth/dal";
import { kitchenDate } from "@/lib/dates";
import { asUser } from "@/lib/server/db";
import { shoppingData } from "@/lib/server/queries";
import { buildShoppingList, formatQuantity } from "@/lib/shopping";

export const metadata = { title: "Shopping" };

export default async function PrintShoppingPage() {
  const profile = await requireProfile({ roles: ["owner", "admin"] });
  const t = await getTranslations();
  const today = kitchenDate();
  const data = await asUser(profile.id, (tx) => shoppingData(tx, today));
  const checked = new Set(data.checks.map((c) => c.item_key));
  const items = buildShoppingList(data.orders, data.ingredients);

  return (
    <>
      <PrintControls />
      <h1 className="mb-1 text-2xl font-bold">{t("adminShopping.title")}</h1>
      <p className="mb-4 text-sm">{today}</p>
      {items.length ? (
        <ul className="grid gap-1.5 text-base">
          {items.map((item) => (
            <li key={item.key} className="flex items-baseline gap-3 break-inside-avoid">
              <span className="inline-block size-4 shrink-0 translate-y-0.5 border-2 border-black text-center text-xs leading-3">
                {checked.has(item.key) ? "✓" : ""}
              </span>
              <span className="font-semibold">{item.name}</span>
              <span className="flex-1 border-b border-dotted border-black" />
              <span className="font-mono">
                {item.total !== null ? formatQuantity(item.total, item.unit, profile.locale) : t("adminShopping.toTaste")}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>{t("adminShopping.empty")}</p>
      )}
    </>
  );
}
