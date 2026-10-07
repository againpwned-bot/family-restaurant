import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { OrderStatusView } from "@/components/client/order-status-view";
import { requireProfile } from "@/lib/auth/dal";
import { kitchenDate } from "@/lib/dates";
import { shouldShowPushPrompt } from "@/lib/push-prompt";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("orders");
  return { title: t("title") };
}

export default async function OrderPage({ params }: PageProps<"/orders/[id]">) {
  const profile = await requireProfile({ roles: ["owner", "client"] });
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createSupabaseServerClient();
  // RLS lets clients read only their own orders (the owner can read all; keep it to their own here).
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .eq("client_id", profile.id)
    .maybeSingle();
  if (!order) notFound();

  const [events, people, dish] = await Promise.all([
    supabase.from("order_events").select("*").eq("order_id", id).order("created_at"),
    supabase.from("profiles").select("id, display_name"),
    order.dish_id
      ? supabase.from("dishes").select("available_on").eq("id", order.dish_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <OrderStatusView
      initialOrder={order}
      initialEvents={events.data ?? []}
      people={Object.fromEntries((people.data ?? []).map((p) => [p.id, p.display_name]))}
      dishAvailable={dish.data?.available_on === kitchenDate()}
      showPushPrompt={await shouldShowPushPrompt()}
    />
  );
}
