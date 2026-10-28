"use client";

import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DIET_TAGS, type DietTag } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DietEditor({
  initial,
  save,
  description,
}: {
  initial: { allergies: string; tags: DietTag[] };
  save: (value: { allergies: string; tags: DietTag[] }) => Promise<boolean>;
  description?: string;
}) {
  const t = useTranslations();
  const id = useId();
  const [allergies, setAllergies] = useState(initial.allergies);
  const [tags, setTags] = useState<DietTag[]>(initial.tags);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const ok = await save({ allergies: allergies.trim(), tags }).catch(() => false);
        setBusy(false);
        if (ok) toast.success(t("dietEditor.saved"));
        else toast.error(t("errors.db.unknown"));
      }}
    >
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">{t("dietEditor.tags")}</legend>
        <div className="flex flex-wrap gap-2">
          {DIET_TAGS.map((tag) => {
            const on = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                onClick={() => setTags((list) => (on ? list.filter((x) => x !== tag) : [...list, tag]))}
                className={cn(
                  "h-9 rounded-full border-2 border-line px-3.5 text-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-10",
                  on ? "bg-destructive text-white" : "bg-card hover:bg-muted",
                )}
              >
                {t(`dietTags.${tag}`)}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-allergies`}>{t("dietEditor.allergies")}</Label>
        <Textarea
          id={`${id}-allergies`}
          value={allergies}
          maxLength={300}
          rows={2}
          placeholder={t("dietEditor.allergiesPlaceholder")}
          onChange={(e) => setAllergies(e.target.value)}
        />
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
