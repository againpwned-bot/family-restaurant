import { getTranslations } from "next-intl/server";

import { OrdersBoard, type DishInfo } from "@/components/admin/orders/orders-board";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth/dal";
import { kitchenDayStart } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminOrdersPage() {
  const profile = await requireProfile({ roles: ["owner", "admin"] });
  const t = await getTranslations();
  const supabase = await createSupabaseServerClient();
  const since = kitchenDayStart().toISOString();

  // Open orders of any day + everything placed today.
  const [orders, people, dishes] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .or(`status.in.(received,accepted,cooking,ready),created_at.gte.${since}`)
      .order("created_at"),
    supabase.from("profiles").select("id, display_name"),
    supabase.from("dishes").select("id, cook_minutes, photo_blur"),
  ]);
  if (orders.error) throw new Error(orders.error.message);

  const dishInfo: DishInfo = Object.fromEntries(
    (dishes.data ?? []).map((d) => [d.id, { cook_minutes: d.cook_minutes, photo_blur: d.photo_blur }]),
  );

  return (
    <>
      <PageHeader
        eyebrow={t("admin.greeting", { name: profile.display_name })}
        title={t("adminOrders.title")}
        description={t("adminOrders.description")}
      />
      <OrdersBoard
        initialOrders={orders.data}
        people={Object.fromEntries((people.data ?? []).map((p) => [p.id, p.display_name]))}
        dishes={dishInfo}
      />
    </>
  );
}
