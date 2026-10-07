import { getFormatter, getTranslations } from "next-intl/server";

import { MenuHome } from "@/components/client/menu-home";
import { PageHeader } from "@/components/layout/page-header";
import { ScrollParallax } from "@/components/motion/scroll-parallax";
import { WebglBackground } from "@/components/three/webgl-background";
import { requireProfile } from "@/lib/auth/dal";
import { KITCHEN_TZ, kitchenDate } from "@/lib/dates";
import { asUser } from "@/lib/server/db";
import { menuForDay } from "@/lib/server/queries";

export default async function HomePage() {
  const profile = await requireProfile({ roles: ["owner", "client"] });
  const t = await getTranslations("home");
  const format = await getFormatter();
  const dishes = await asUser(profile.id, (tx) => menuForDay(tx, kitchenDate()));
  const date = format.dateTime(new Date(), { weekday: "long", day: "numeric", month: "long", timeZone: KITCHEN_TZ });

  return (
    <>
      <WebglBackground
        className="pointer-events-none fixed inset-0 -z-10"
        color="#dc2626"
        opacity={0.12}
        additive={false}
      />
      <ScrollParallax speed={0.3} fade>
        <PageHeader
          eyebrow={t("greeting", { name: profile.display_name })}
          title={t("title")}
          description={`${date} · ${t("count", { count: dishes.length })}`}
        />
      </ScrollParallax>
      <MenuHome initialDishes={dishes} />
    </>
  );
}
