import { BellRing, KeyRound, Languages, Palette, Sparkles, UserRound } from "lucide-react";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { PushToggle } from "@/components/notifications/push-toggle";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { AnimationSetting, LanguageSetting, ThemeSetting } from "@/components/settings/preference-switchers";
import type { Profile } from "@/lib/types";
import { THEME_COOKIE, resolveTheme } from "@/lib/theme";

/** Shared by /settings (client side) and /admin/settings. */
export async function SettingsView({ profile }: { profile: Profile }) {
  const t = await getTranslations();
  const theme = resolveTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <>
      <PageHeader title={t("settings.title")} description={t("settings.description")} />
      <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-6">
        <div className="grid gap-4 lg:gap-6">
          <Section icon={<UserRound />} title={t("settings.account.title")}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-base">
              <dt className="text-muted-foreground">{t("settings.account.username")}</dt>
              <dd className="font-semibold">{profile.username}</dd>
              <dt className="text-muted-foreground">{t("settings.account.role")}</dt>
              <dd className="font-semibold">{t(`roles.${profile.role}`)}</dd>
            </dl>
          </Section>

          <Section
            icon={<Languages />}
            title={t("settings.language.title")}
            description={t("settings.language.description")}
          >
            <LanguageSetting />
          </Section>

          <Section icon={<Palette />} title={t("settings.theme.title")} description={t("settings.theme.description")}>
            <ThemeSetting current={theme} />
          </Section>

          <Section icon={<Sparkles />} title={t("animations.title")} description={t("animations.description")}>
            <AnimationSetting />
          </Section>
        </div>

        <div className="grid gap-4 lg:gap-6">
          <Section icon={<BellRing />} title={t("push.title")} description={t("push.description")}>
            <PushToggle />
          </Section>
          <Section
            icon={<KeyRound />}
            title={t("settings.password.title")}
            description={t("settings.password.description")}
          >
            <ChangePasswordForm username={profile.username} />
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({
  icon,
  title,
  description,
  className,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-5 sm:p-6 ${className ?? ""}`}>
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground [&_svg]:size-5">
          {icon}
        </span>
        <div>
          <h2 className="font-heading text-lg font-bold">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}
