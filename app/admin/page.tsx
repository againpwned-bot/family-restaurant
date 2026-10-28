import { getTranslations } from "next-intl/server";

import { OrdersBoard, type DishInfo } from "@/components/admin/orders/orders-board";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth/dal";
import { kitchenDayStart } from "@/lib/dates";
import { shouldShowPushPrompt } from "@/lib/push-prompt";
import { asUser } from "@/lib/server/db";
import { boardOrders, dishInfo, peopleDiets, peopleNames } from "@/lib/server/queries";

export default async function AdminOrdersPage() {
  const profile = await requireProfile({ roles: ["owner", "admin"] });
  const t = await getTranslations();
  const { orders, people, diets, dishes } = await asUser(profile.id, async (tx) => ({
    orders: await boardOrders(tx, kitchenDayStart().toISOString()),
    people: await peopleNames(tx),
    diets: await peopleDiets(tx),
    dishes: await dishInfo(tx),
  }));

  const info: DishInfo = Object.fromEntries(
    dishes.map((d) => [d.id, { cook_minutes: d.cook_minutes, photo_blur: d.photo_blur }]),
  );

  return (
    <>
      <PageHeader
        eyebrow={t("admin.greeting", { name: profile.display_name })}
        title={t("adminOrders.title")}
        description={t("adminOrders.description")}
      />
      <OrdersBoard
        initialOrders={orders}
        people={people}
        diets={diets}
        dishes={info}
        showPushPrompt={await shouldShowPushPrompt()}
      />
    </>
  );
}
