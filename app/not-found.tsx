import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16 text-center">
      <div className="max-w-md">
        <LogoMark className="mx-auto size-14 text-primary" />
        <h1 className="mt-6 font-heading text-3xl font-bold sm:text-4xl">{t("notFoundTitle")}</h1>
        <p className="mt-3 text-muted-foreground">{t("notFoundText")}</p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/">{t("goHome")}</Link>
        </Button>
      </div>
    </main>
  );
}
