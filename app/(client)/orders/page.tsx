import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { MyOrders } from "@/components/client/my-orders";
import { PageHeader } from "@/components/layout/page-header";
import { PushPrompt } from "@/components/notifications/push-prompt";
import { requireProfile } from "@/lib/auth/dal";
import { shouldShowPushPrompt } from "@/lib/push-prompt";
import { asUser } from "@/lib/server/db";
import { activeOrders, orderHistory } from "@/lib/server/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("orders");
  return { title: t("title") };
}

export default async function MyOrdersPage() {
  const profile = await requireProfile({ roles: ["owner", "client"] });
  const t = await getTranslations("orders");
  const { active, history } = await asUser(profile.id, async (tx) => ({
    active: await activeOrders(tx, profile.id),
    history: await orderHistory(tx, profile.id),
  }));

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {(await shouldShowPushPrompt()) ? (
        <div className="mb-6">
          <PushPrompt />
        </div>
      ) : null}
      <MyOrders userId={profile.id} initialActive={active} initialHistory={history} />
    </>
  );
}
