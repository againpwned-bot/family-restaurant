"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useOptimistic, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { setLocale, setTheme } from "@/app/actions/preferences";
import { useAnimation } from "@/components/providers/animation-provider";
import { LOCALES } from "@/i18n/config";
import type { ThemePref } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; icon?: ReactNode; lang?: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "inline-flex flex-wrap gap-1 rounded-2xl border-2 border-line bg-muted/60 p-1",
        disabled && "opacity-70",
      )}
      onKeyDown={(event) => {
        const index = options.findIndex((o) => o.value === value);
        const step =
          event.key === "ArrowRight" || event.key === "ArrowDown"
            ? 1
            : event.key === "ArrowLeft" || event.key === "ArrowUp"
              ? -1
              : 0;
        if (!step) return;
        event.preventDefault();
        const next = options[(index + step + options.length) % options.length];
        onChange(next.value);
        (event.currentTarget.querySelector(`[data-value="${next.value}"]`) as HTMLElement | null)?.focus();
      }}
    >
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            data-value={option.value}
            lang={option.lang}
            disabled={disabled}
            onClick={() => !checked && onChange(option.value)}
            className={cn(
              "hover-overlay inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-11 [&_svg]:size-4",
              checked ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "text-muted-foreground",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function LanguageSetting() {
  const t = useTranslations("settings.language");
  const locale = useLocale();
  const [optimistic, setOptimistic] = useOptimistic(locale);
  const [pending, startTransition] = useTransition();

  return (
    <Segmented
      label={t("title")}
      value={optimistic}
      disabled={pending}
      options={LOCALES.map((value) => ({ value, label: t(value), lang: value }))}
      onChange={(value) =>
        startTransition(async () => {
          setOptimistic(value);
          await setLocale(value);
        })
      }
    />
  );
}

export function ThemeSetting({ current }: { current: ThemePref }) {
  const t = useTranslations("settings.theme");
  const [optimistic, setOptimistic] = useOptimistic(current);
  const [pending, startTransition] = useTransition();

  return (
    <Segmented
      label={t("title")}
      value={optimistic}
      disabled={pending}
      options={[
        { value: "system", label: t("system"), icon: <Monitor aria-hidden="true" /> },
        { value: "light", label: t("light"), icon: <Sun aria-hidden="true" /> },
        { value: "dark", label: t("dark"), icon: <Moon aria-hidden="true" /> },
      ]}
      onChange={(value) =>
        startTransition(async () => {
          setOptimistic(value);
          await setTheme(value);
        })
      }
    />
  );
}

export function AnimationSetting() {
  const t = useTranslations("animations");
  const { pref, setPref, detected, renderer } = useAnimation();
  return (
    <div className="grid gap-3">
      <Segmented
        label={t("title")}
        value={pref}
        options={(["auto", "full", "lite", "reduced"] as const).map((value) => ({ value, label: t(value) }))}
        onChange={(value) => void setPref(value).then(() => toast.success(t("saved")))}
      />
      {detected ? (
        <p className="text-sm text-muted-foreground">
          {t("detected", { tier: t(detected) })}
          {renderer ? <span className="block text-xs">{t("gpu", { renderer })}</span> : null}
        </p>
      ) : null}
    </div>
  );
}
