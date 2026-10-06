import { getTranslations } from "next-intl/server";

import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth/dal";

export default async function HomePage() {
  const profile = await requireProfile({ roles: ["owner", "client"] });
  const t = await getTranslations("home");

  return (
    <>
      <PageHeader eyebrow={t("greeting", { name: profile.display_name })} title={t("title")} />
      <ComingSoon />
    </>
  );
}
