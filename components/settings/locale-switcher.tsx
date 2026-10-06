"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

import { setLocale } from "@/app/actions/preferences";
import { LOCALES } from "@/i18n/config";
import { cn } from "@/lib/utils";

/** Compact RO / EN segmented switch. */
export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("common");
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label={t("language")}
      className={cn(
        "inline-flex rounded-full border border-border bg-card p-0.5 text-xs font-bold tracking-wide",
        pending && "opacity-70",
        className,
      )}
    >
      {LOCALES.map((value) => {
        const active = value === locale;
        return (
          <button
            key={value}
            type="button"
            lang={value}
            aria-pressed={active}
            disabled={pending}
            onClick={() => {
              if (!active) startTransition(() => setLocale(value));
            }}
            className={cn(
              "hover-overlay min-w-11 rounded-full px-3 py-1.5 uppercase outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:py-2.5",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}
