import { getFormatter, getTranslations } from "next-intl/server";

import { MenuHome } from "@/components/client/menu-home";
import { HeroTitle } from "@/components/decor/hero-title";
import { Marquee } from "@/components/decor/marquee";
import { SpinStamp } from "@/components/decor/spin-stamp";
import { ScrollParallax } from "@/components/motion/scroll-parallax";
import { requireProfile } from "@/lib/auth/dal";
import { KITCHEN_TZ, kitchenDate } from "@/lib/dates";
import { asUser } from "@/lib/server/db";
import { menuForDay } from "@/lib/server/queries";

export default async function HomePage() {
  const profile = await requireProfile({ roles: ["owner", "client"] });
  const t = await getTranslations("home");
  const format = await getFormatter();
  const dishes = await asUser(profile.id, (tx) => menuForDay(tx, kitchenDate()));
  const now = new Date();
  const date = format.dateTime(now, { weekday: "long", day: "numeric", month: "long", timeZone: KITCHEN_TZ });
  const day = format.dateTime(now, { day: "numeric", timeZone: KITCHEN_TZ });
  const month = format.dateTime(now, { month: "short", timeZone: KITCHEN_TZ });
  const ticker = dishes.length ? [...dishes.slice(0, 8).map((d) => d.name), t("marquee")] : [t("marquee")];

  return (
    <>
      <ScrollParallax speed={0.3} fade>
        <section className="mb-7 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-5 sm:mb-9">
          <div className="col-span-2 lg:col-span-1">
            <p className="inline-flex origin-left -rotate-2 items-center gap-2 font-hand text-[1.7rem] leading-none font-bold text-brand-ink sm:text-3xl">
              {t("greeting", { name: profile.display_name })}
              <span className="animate-wave" data-anim="loop" aria-hidden="true">
                👋
              </span>
            </p>
            <HeroTitle text={t("title")} className="mt-4 pb-3 text-[clamp(3.3rem,14vw,8.5rem)]" />
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:col-start-1 lg:row-start-2">
            <span className="rounded-full border-2 border-line bg-card px-3.5 py-1.5 text-sm font-bold first-letter:uppercase sm:text-base">
              {date}
            </span>
            <span className="rounded-full border-2 border-line bg-gold px-3.5 py-1.5 text-sm font-bold text-gold-foreground sm:text-base">
              {t("count", { count: dishes.length })}
            </span>
          </div>
          <SpinStamp
            text={t("stamp")}
            className="size-24 rotate-6 sm:size-32 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:size-44"
          >
            <span className="grid leading-none">
              <span className="font-heading text-2xl font-black sm:text-3xl lg:text-4xl">{day}</span>
              <span className="text-[0.6rem] font-extrabold tracking-widest uppercase sm:text-xs">{month}</span>
            </span>
          </SpinStamp>
        </section>
      </ScrollParallax>
      <Marquee items={ticker} className="-mx-4 mb-8 sm:-mx-6 sm:mb-10" />
      <MenuHome initialDishes={dishes} />
    </>
  );
}
