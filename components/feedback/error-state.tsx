"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations();
  return (
    <div role="alert" className="grid place-items-center rounded-[1.5rem] bg-card sticker px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-7" aria-hidden="true" />
      </span>
      <h2 className="mt-4 font-heading text-xl font-bold">{t("errors.genericTitle")}</h2>
      <p className="mt-1 max-w-sm text-muted-foreground">{t("errors.genericText")}</p>
      <Button onClick={onRetry} variant="outline" className="mt-6">
        <RefreshCw aria-hidden="true" />
        {t("common.retry")}
      </Button>
    </div>
  );
}
