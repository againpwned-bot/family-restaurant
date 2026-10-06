import { getTranslations } from "next-intl/server";

/** First focusable element on every page: jumps past the navigation. */
export async function SkipLink() {
  const t = await getTranslations("nav");
  return (
    <a
      href="#content"
      className="fixed top-2 left-2 z-[60] -translate-y-20 rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground shadow-lg outline-none focus-visible:translate-y-0 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {t("skipToContent")}
    </a>
  );
}
