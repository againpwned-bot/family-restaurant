"use client";

import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TIMER_PRESETS } from "@/lib/orders";
import type { Order } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type DialogBase = {
  order: Order;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
};

export function AcceptDialog({
  order,
  clientName,
  open,
  onOpenChange,
  busy,
  defaultMinutes,
  onConfirm,
}: DialogBase & { defaultMinutes: number; onConfirm: (minutes: number) => void }) {
  const t = useTranslations("adminOrders.acceptDialog");
  const tc = useTranslations("common");
  const [minutes, setMinutes] = useState(String(defaultMinutes));
  const value = Number(minutes);
  const valid = Number.isInteger(value) && value >= 1 && value <= 600;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) onConfirm(value);
          }}
        >
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{t("title", { number: order.number })}</DialogTitle>
            <DialogDescription>
              {t("description", { dish: order.dish_name, quantity: order.quantity, client: clientName })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Label htmlFor={`accept-min-${order.id}`}>{t("minutes")}</Label>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("minutes")}>
              {TIMER_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={value === preset}
                  onClick={() => setMinutes(String(preset))}
                  className={cn(
                    "hover-overlay h-10 min-w-14 rounded-xl border px-3 text-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-11",
                    value === preset ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
                  )}
                >
                  {tc("minutesShort", { minutes: preset })}
                </button>
              ))}
            </div>
            <Input
              id={`accept-min-${order.id}`}
              type="number"
              inputMode="numeric"
              min={1}
              max={600}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              aria-invalid={!valid || undefined}
              className="max-w-32"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={!valid || busy}>
              {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              {t("confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RejectDialog({
  order,
  clientName,
  open,
  onOpenChange,
  busy,
  onConfirm,
}: DialogBase & { onConfirm: (reason: string) => void }) {
  const t = useTranslations("adminOrders.rejectDialog");
  const tc = useTranslations("common");
  const [reason, setReason] = useState("");
  const quick = [t("quick1"), t("quick2"), t("quick3")];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            onConfirm(reason.trim());
          }}
        >
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{t("title", { number: order.number })}</DialogTitle>
            <DialogDescription>
              {t("description", { dish: order.dish_name, quantity: order.quantity, client: clientName })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              {quick.map((text) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => setReason(text)}
                  className="hover-overlay h-9 rounded-full border border-border bg-card px-3 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-10"
                >
                  {text}
                </button>
              ))}
            </div>
            <Label htmlFor={`reject-reason-${order.id}`}>{t("reason")}</Label>
            <Textarea
              id={`reject-reason-${order.id}`}
              value={reason}
              maxLength={300}
              rows={3}
              placeholder={t("reasonPlaceholder")}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" variant="destructive" disabled={busy}>
              {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              {t("confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
