import { getTranslations } from "next-intl/server";

import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth/dal";

export default async function AdminOrdersPage() {
  const profile = await requireProfile({ roles: ["owner", "admin"] });
  const t = await getTranslations();

  return (
    <>
      <PageHeader eyebrow={t("admin.greeting", { name: profile.display_name })} title={t("nav.orders")} />
      <ComingSoon />
    </>
  );
}
