import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { BroadcastComposer } from "@/components/admin/broadcasts/broadcast-composer";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth/dal";
import { asUser } from "@/lib/server/db";
import { peopleInfo, recentBroadcasts } from "@/lib/server/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("broadcasts");
  return { title: t("title") };
}

export default async function BroadcastsPage() {
  const me = await requireProfile({ roles: ["owner", "admin"] });
  const t = await getTranslations("broadcasts");
  const data = await asUser(me.id, async (tx) => ({
    history: await recentBroadcasts(tx),
    people: (await peopleInfo(tx)).filter((p) => p.id !== me.id),
  }));
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <BroadcastComposer initialHistory={data.history} people={data.people} />
    </>
  );
}
