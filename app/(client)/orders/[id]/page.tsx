import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { OrderStatusView } from "@/components/client/order-status-view";
import { requireProfile } from "@/lib/auth/dal";
import { kitchenDate } from "@/lib/dates";
import { shouldShowPushPrompt } from "@/lib/push-prompt";
import { asUser } from "@/lib/server/db";
import { dishAvailableOn, orderEvents, ownOrder, peopleNames } from "@/lib/server/queries";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("orders");
  return { title: t("title") };
}

export default async function OrderPage({ params }: PageProps<"/orders/[id]">) {
  const profile = await requireProfile({ roles: ["owner", "client"] });
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  // RLS lets clients read only their own orders (the owner can read all; keep it to their own here).
  const data = await asUser(profile.id, async (tx) => {
    const order = await ownOrder(tx, profile.id, id);
    if (!order) return null;
    return {
      order,
      events: await orderEvents(tx, id),
      people: await peopleNames(tx),
      availableOn: order.dish_id ? await dishAvailableOn(tx, order.dish_id) : null,
    };
  });
  if (!data) notFound();

  return (
    <OrderStatusView
      initialOrder={data.order}
      initialEvents={data.events}
      people={data.people}
      dishAvailable={data.availableOn === kitchenDate()}
      showPushPrompt={await shouldShowPushPrompt()}
    />
  );
}
