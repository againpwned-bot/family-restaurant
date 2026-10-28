import { BellRing, CalendarCheck, Timer } from "lucide-react";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";

import { LoginForm } from "@/components/auth/login-form";
import { HeroTitle } from "@/components/decor/hero-title";
import { Doodle, type DoodleName } from "@/components/decor/kitchen-doodles";
import { SpinStamp } from "@/components/decor/spin-stamp";
import { LogoMark } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/settings/locale-switcher";
import { WebglBackground } from "@/components/three/webgl-background";
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
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <section
        aria-labelledby="brand-title"
        className="relative isolate overflow-hidden rounded-b-[2.5rem] border-b-2 border-line bg-[#1d1915] px-6 pt-[max(env(safe-area-inset-top),1.5rem)] pb-16 text-[#f5eee2] sm:px-10 lg:rounded-none lg:border-r-2 lg:border-b-0 lg:px-14 lg:py-14"
      >
        <PlateDecoration />
        <BoardDoodles />
        <WebglBackground className="pointer-events-none absolute inset-0 -z-10" opacity={0.3} />
        <div className="relative flex h-full flex-col">
          <div className="flex items-center gap-2.5">
            <span className="grid size-11 place-items-center rounded-full border-2 border-[#f5eee2] bg-[#e2482a] text-[#fff8f0]">
              <LogoMark className="size-7" />
            </span>
            <span className="font-heading text-2xl font-bold tracking-tight">{tc("appName")}</span>
          </div>

          <div className="mt-8 max-w-xl lg:mt-auto lg:mb-auto">
            <HeroTitle
              id="brand-title"
              text={t("heroTitle")}
              className="text-[clamp(2.8rem,11vw,6.2rem)]"
              accentClassName="text-[#ff6a45]"
            />
            <p className="mt-8 max-w-md text-base/relaxed text-[#f5eee2]/80 sm:text-lg/relaxed">{t("heroText")}</p>
            <ul className="mt-8 hidden gap-3 lg:grid">
              {points.map(({ icon: Icon, text }, i) => (
                <li
                  key={text}
                  className="deal-in flex items-center gap-3 text-base font-semibold"
                  style={{ "--i": i + 4, "--deal-rot": "0deg" } as CSSProperties}
                >
                  <span className="grid size-10 place-items-center rounded-full border-2 border-[#f5eee2] bg-[#e3a21a] text-[#241800]">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <SpinStamp text={t("stamp")} className="absolute -right-6 -bottom-6 size-32 rotate-12 max-lg:hidden xl:size-40">
          <LogoMark className="size-10" />
        </SpinStamp>
      </section>

      <section className="relative flex items-start justify-center px-4 pb-10 sm:px-8 lg:items-center lg:py-12">
        <div className="absolute top-4 right-4 hidden lg:block">
          <LocaleSwitcher />
        </div>

        <div className="relative -mt-9 w-full max-w-md rounded-[2rem] bg-card p-6 sticker sm:p-8 lg:mt-0">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="-rotate-2 font-hand text-2xl leading-none font-bold text-brand-ink">{t("scribble")}</p>
              <h2 className="mt-1 font-heading text-3xl font-black tracking-tight sm:text-4xl">{t("title")}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">{t("subtitle")}</p>
            </div>
            <LocaleSwitcher className="shrink-0 lg:hidden" />
          </div>

          <LoginForm next={next} initialError={initialError} />

          <p className="mt-6 text-center font-hand text-xl font-bold text-muted-foreground">{t("forgot")}</p>
        </div>
      </section>
    </main>
  );
}

function BoardDoodles() {
  const spots: { name: DoodleName; className: string; delay: number }[] = [
    { name: "whisk", className: "top-[12%] right-[8%] size-20 rotate-12", delay: 0 },
    { name: "chili", className: "top-[48%] right-[30%] size-14 -rotate-12 max-sm:hidden", delay: -5 },
    { name: "leaf", className: "bottom-[14%] left-[6%] size-16 max-lg:hidden", delay: -9 },
    { name: "sparkle", className: "top-[30%] left-[58%] size-8", delay: -3 },
  ];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      {spots.map((spot) => (
        <Doodle
          key={spot.name}
          name={spot.name}
          className={`absolute animate-drift text-[#f5eee2]/15 ${spot.className}`}
          style={{ animationDelay: `${spot.delay}s` }}
          {...{ "data-anim": "loop" }}
        />
      ))}
    </div>
  );
}

function PlateDecoration() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 600 600"
      className="pointer-events-none absolute -right-40 -bottom-48 -z-10 size-[30rem] text-[#f5eee2] sm:-right-24 sm:size-[36rem] lg:-right-44 lg:-bottom-40 lg:size-[44rem]"
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
