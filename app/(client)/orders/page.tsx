import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { MyOrders } from "@/components/client/my-orders";
import { PageHeader } from "@/components/layout/page-header";
import { PushPrompt } from "@/components/notifications/push-prompt";
import { requireProfile } from "@/lib/auth/dal";
import { CLOSED_STATUSES, HISTORY_PAGE, OPEN_STATUSES } from "@/lib/orders";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("orders");
  return { title: t("title") };
}

export default async function MyOrdersPage() {
  const profile = await requireProfile({ roles: ["owner", "client"] });
  const t = await getTranslations("orders");
  const supabase = await createSupabaseServerClient();
  const [active, history] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .eq("client_id", profile.id)
      .in("status", [...OPEN_STATUSES])
      .order("created_at"),
    supabase
      .from("orders")
      .select("*")
      .eq("client_id", profile.id)
      .in("status", [...CLOSED_STATUSES])
      .order("created_at", { ascending: false })
      .limit(HISTORY_PAGE),
  ]);
  if (active.error) throw new Error(active.error.message);
  if (history.error) throw new Error(history.error.message);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="mb-6">
        <PushPrompt />
      </div>
      <MyOrders userId={profile.id} initialActive={active.data} initialHistory={history.data ?? []} />
    </>
  );
}
