"use client";

import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";

import { saveKitchenSettings } from "@/app/actions/kitchen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { safe } from "@/lib/action-result";
import type { AppSettings } from "@/lib/types";

const FIELDS = [
  ["cutoffBreakfast", "cutoff_breakfast"],
  ["cutoffLunch", "cutoff_lunch"],
  ["cutoffDinner", "cutoff_dinner"],
  ["cutoffAll", "cutoff_all"],
] as const;

export function KitchenSettings({ initial }: { initial: AppSettings }) {
  const t = useTranslations();
  const id = useId();
  const [requirePush, setRequirePush] = useState(initial.require_push);
  const [times, setTimes] = useState<Record<(typeof FIELDS)[number][0], string>>({
    cutoffBreakfast: initial.cutoff_breakfast ?? "",
    cutoffLunch: initial.cutoff_lunch ?? "",
    cutoffDinner: initial.cutoff_dinner ?? "",
    cutoffAll: initial.cutoff_all ?? "",
  });
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="grid gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const { error } = await safe(
          saveKitchenSettings({
            requirePush,
            cutoffBreakfast: times.cutoffBreakfast || null,
            cutoffLunch: times.cutoffLunch || null,
            cutoffDinner: times.cutoffDinner || null,
            cutoffAll: times.cutoffAll || null,
          }),
        );
        setBusy(false);
        if (error) toast.error(t(`errors.db.${error.message}`));
        else toast.success(t("kitchen.saved"));
      }}
    >
      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-semibold">{t("kitchen.cutoffs")}</legend>
        <p className="text-sm text-muted-foreground">{t("kitchen.cutoffsHint")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map(([key]) => (
            <div key={key} className="grid gap-1.5">
              <Label htmlFor={`${id}-${key}`}>{t(`kitchen.${key}`)}</Label>
              <div className="flex gap-2">
                <Input
                  id={`${id}-${key}`}
                  type="time"
                  value={times[key]}
                  onChange={(e) => setTimes((v) => ({ ...v, [key]: e.target.value }))}
                  className="max-w-36"
                />
                {times[key] ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setTimes((v) => ({ ...v, [key]: "" }))}>
                    {t("kitchen.noLimit")}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/60 p-3">
        <div>
          <Label htmlFor={`${id}-push`} className="text-base">
            {t("kitchen.requirePush")}
          </Label>
          <p className="text-sm text-muted-foreground">{t("kitchen.requirePushHint")}</p>
        </div>
        <Switch id={`${id}-push`} checked={requirePush} onCheckedChange={setRequirePush} />
      </div>

      <div>
        <Button type="submit" disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}
