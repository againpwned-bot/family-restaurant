import { ChefHat } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { KitchenSettings } from "@/components/settings/kitchen-settings";
import { Section, SettingsView } from "@/components/settings/settings-view";
import { requireProfile } from "@/lib/auth/dal";
import { asUser } from "@/lib/server/db";
import { appSettings } from "@/lib/server/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

export default async function AdminSettingsPage() {
  const profile = await requireProfile({ roles: ["owner", "admin"] });
  const t = await getTranslations("kitchen");
  const settings = await asUser(profile.id, appSettings);
  return (
    <SettingsView
      profile={profile}
      extra={
        <Section icon={<ChefHat />} title={t("title")} description={t("description")}>
          <KitchenSettings initial={settings} />
        </Section>
      }
    />
  );
}
