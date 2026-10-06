import { BellRing, CalendarCheck, Timer } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LoginForm } from "@/components/auth/login-form";
import { LogoMark } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/settings/locale-switcher";
import { safeNextPath } from "@/lib/auth/roles";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("pageTitle") };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const t = await getTranslations("login");
  const tc = await getTranslations("common");
  const next = safeNextPath(typeof params.next === "string" ? params.next : null) ?? undefined;
  const initialError = params.error === "no_access" ? "no_access" : undefined;

  const points = [
    { icon: CalendarCheck, text: t("heroPoint1") },
    { icon: Timer, text: t("heroPoint2") },
    { icon: BellRing, text: t("heroPoint3") },
  ];

  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Brand block: compact band on phones, a full panel on desktop. */}
      <section
        aria-labelledby="brand-title"
        className="relative isolate overflow-hidden rounded-b-[2rem] bg-primary px-6 pt-[max(env(safe-area-inset-top),1.5rem)] pb-14 text-primary-foreground sm:px-10 lg:rounded-none lg:px-14 lg:py-14"
      >
        <PlateDecoration />
        <div className="relative flex h-full flex-col">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-9" />
            <span className="font-heading text-xl font-semibold tracking-tight">{tc("appName")}</span>
          </div>

          <div className="mt-8 max-w-xl lg:mt-auto lg:mb-auto">
            <h1
              id="brand-title"
              className="font-heading text-[2.6rem] leading-[1.02] font-bold tracking-tight sm:text-6xl lg:text-7xl"
            >
              {t("heroTitle")}
            </h1>
            <p className="mt-4 max-w-md text-base/relaxed text-primary-foreground/85 sm:text-lg/relaxed">
              {t("heroText")}
            </p>
            <ul className="mt-8 hidden gap-3 lg:grid">
              {points.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-base font-medium">
                  <span className="grid size-10 place-items-center rounded-full bg-primary-foreground/15">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="relative flex items-start justify-center px-4 pb-10 sm:px-8 lg:items-center lg:py-12">
        <div className="absolute top-4 right-4 hidden lg:block">
          <LocaleSwitcher />
        </div>

        <div className="relative -mt-8 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl shadow-primary/5 sm:p-8 lg:mt-0 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">{t("subtitle")}</p>
            </div>
            <LocaleSwitcher className="shrink-0 lg:hidden" />
          </div>

          <LoginForm next={next} initialError={initialError} />

          <p className="mt-6 text-center text-sm text-muted-foreground">{t("forgot")}</p>
        </div>
      </section>
    </main>
  );
}

/** Concentric "plate" rings and a few grains of pepper: pure SVG, no images. */
function PlateDecoration() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 600 600"
      className="pointer-events-none absolute -right-40 -bottom-48 -z-10 size-[30rem] text-primary-foreground sm:-right-24 sm:size-[36rem] lg:-right-44 lg:-bottom-40 lg:size-[44rem]"
    >
      <circle cx="300" cy="300" r="290" fill="currentColor" opacity="0.07" />
      <circle cx="300" cy="300" r="230" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.18" />
      <circle cx="300" cy="300" r="180" fill="currentColor" opacity="0.08" />
      <circle
        cx="300"
        cy="300"
        r="120"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.2"
        strokeDasharray="4 10"
      />
      <g fill="currentColor" opacity="0.35">
        <circle cx="250" cy="250" r="5" />
        <circle cx="340" cy="230" r="3.5" />
        <circle cx="320" cy="330" r="4.5" />
        <circle cx="260" cy="350" r="3" />
      </g>
    </svg>
  );
}
