import { ChefHat } from "lucide-react";
import { getTranslations } from "next-intl/server";

/** Temporary placeholder for sections built in later stages. */
export async function ComingSoon() {
  const t = await getTranslations("common");
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-secondary text-secondary-foreground">
        <ChefHat className="size-7" aria-hidden="true" />
      </span>
      <h2 className="mt-4 font-heading text-xl font-bold">{t("comingSoonTitle")}</h2>
      <p className="mt-1 max-w-sm text-muted-foreground">{t("comingSoonDescription")}</p>
    </div>
  );
}
