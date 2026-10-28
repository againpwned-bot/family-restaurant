"use client";

import { LoaderCircle, Minus, Plus, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useNow } from "@/hooks/use-now";
import { isPastCutoff } from "@/lib/cutoff";
import { kitchenHHMM, kitchenTimeToday } from "@/lib/dates";
import { dbErrorKey } from "@/lib/errors";
import { placeOrder } from "@/app/actions/orders";
import { safe } from "@/lib/action-result";
import { cn } from "@/lib/utils";

const MAX_PORTIONS = 10;

function requestedInstant(hhmm: string, now: number): { at: Date; tomorrow: boolean } | null {
  const today = kitchenTimeToday(hhmm, new Date(now));
  if (!today) return null;
  return today.getTime() > now + 60_000
    ? { at: today, tomorrow: false }
    : { at: new Date(today.getTime() + 24 * 3600_000), tomorrow: true };
}

function suggestedTime(cookMinutes: number | null) {
  const at = new Date(Date.now() + ((cookMinutes ?? 0) + 5) * 60_000);
  at.setMinutes(Math.ceil(at.getMinutes() / 5) * 5, 0, 0);
  return kitchenHHMM(at);
}

export function OrderForm({
  dishId,
  cookMinutes,
  available: onMenu,
  cutoff,
}: {
  dishId: string;
  cookMinutes: number | null;
  available: boolean;
  cutoff: string | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const id = useId();
  const [quantity, setQuantity] = useState(1);
  const [mode, setMode] = useState<"asap" | "time">("asap");
  const [time, setTime] = useState(() => suggestedTime(cookMinutes));
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const now = useNow();
  const closed = onMenu && now !== null && isPastCutoff(cutoff, now);
  const available = onMenu && !closed;
  const preview = mode === "time" && now !== null ? requestedInstant(time, now) : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const instant = mode === "time" ? requestedInstant(time, Date.now())?.at : null;
    if (mode === "time" && !instant) return void toast.error(t("orderForm.timeInvalid"));
    setSending(true);
    const { data, error } = await safe(
      placeOrder({
        dishId,
        quantity,
        comment: comment.trim() || null,
        requestedFor: instant ? instant.toISOString() : null,
      }),
    );
    if (error || !data) {
      setSending(false);
      toast.error(t(`errors.db.${dbErrorKey(error)}`));
      if (dbErrorKey(error) === "dish_unavailable") router.refresh();
      return;
    }
    toast.success(t("orderForm.sent"));
    router.push(`/orders/${data.id}`);
  }

  return (
    <form onSubmit={submit} className="grid gap-5" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="font-heading text-2xl font-bold">
        {t("orderForm.title")}
      </h2>
      {onMenu && cutoff ? (
        <p
          role="status"
          className={cn(
            "-mt-2 rounded-xl px-3 py-2 text-sm font-semibold",
            closed ? "bg-destructive/10 text-destructive" : "bg-gold-soft text-gold-ink",
          )}
        >
          {closed ? t("orderForm.closed", { time: cutoff }) : t("orderForm.closesAt", { time: cutoff })}
        </p>
      ) : null}

      <fieldset className="grid gap-2" disabled={!available || sending}>
        <legend className="mb-2 text-sm font-semibold">{t("orderForm.quantity")}</legend>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label={t("orderForm.decrease")}
            disabled={quantity <= 1}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            <Minus />
          </Button>
          <output aria-live="polite" className="min-w-28 text-center text-lg font-bold tabular-nums">
            {t("orderForm.portions", { count: quantity })}
          </output>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label={t("orderForm.increase")}
            disabled={quantity >= MAX_PORTIONS}
            onClick={() => setQuantity((q) => Math.min(MAX_PORTIONS, q + 1))}
          >
            <Plus />
          </Button>
        </div>
      </fieldset>

      <fieldset className="grid gap-2" disabled={!available || sending}>
        <legend className="mb-2 text-sm font-semibold">{t("orderForm.when")}</legend>
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
          {(["asap", "time"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                "hover-overlay h-12 rounded-xl border px-4 text-left text-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                mode === value
                  ? "border-primary bg-secondary text-secondary-foreground ring-1 ring-primary"
                  : "border-border bg-card",
              )}
            >
              {value === "asap" ? t("orderForm.asap") : t("orderForm.atTime")}
            </button>
          ))}
        </div>
        {mode === "time" ? (
          <div className="flex items-center gap-3">
            <Label htmlFor={`${id}-time`} className="sr-only">
              {t("orderForm.time")}
            </Label>
            <Input
              id={`${id}-time`}
              type="time"
              step={300}
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="max-w-36"
              aria-invalid={(now !== null && !preview) || undefined}
            />
            {preview?.tomorrow ? (
              <span className="text-sm font-semibold text-gold-ink">{t("orderForm.tomorrow", { time })}</span>
            ) : null}
          </div>
        ) : null}
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor={`${id}-comment`}>{t("orderForm.comment")}</Label>
        <Textarea
          id={`${id}-comment`}
          value={comment}
          maxLength={500}
          rows={3}
          disabled={!available || sending}
          placeholder={t("orderForm.commentPlaceholder")}
          onChange={(e) => setComment(e.target.value)}
          aria-describedby={`${id}-count`}
        />
        <p id={`${id}-count`} className="text-right text-xs text-muted-foreground tabular-nums">
          {t("orderForm.commentCount", { count: comment.length })}
        </p>
      </div>

      <Button type="submit" size="lg" className="h-14 text-base" disabled={!available || sending}>
        {sending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
        {sending ? t("orderForm.submitting") : t("orderForm.submit")}
      </Button>
    </form>
  );
}
