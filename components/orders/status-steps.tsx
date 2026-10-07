"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

import type { OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS = ["received", "accepted", "cooking", "ready"] as const;

/** Received -> Accepted -> Cooking -> Ready, with the current step highlighted. */
export function StatusSteps({ status, className }: { status: OrderStatus; className?: string }) {
  const t = useTranslations("orders");
  if (status === "rejected" || status === "cancelled") return null;
  const current = status === "handed_over" ? STEPS.length : STEPS.indexOf(status as (typeof STEPS)[number]);

  return (
    <ol aria-label={t("stepsLabel")} className={cn("grid grid-cols-4 gap-1", className)}>
      {STEPS.map((step, i) => {
        const doneStep = i < current || (i === current && step === "ready");
        const active = i === current && step !== "ready";
        return (
          <li
            key={step}
            className="grid justify-items-center gap-1.5 text-center"
            aria-current={i === current ? "step" : undefined}
          >
            <div className="relative flex w-full items-center justify-center">
              {i > 0 ? (
                <span
                  className={cn(
                    "absolute top-1/2 right-1/2 h-0.5 w-full -translate-y-1/2",
                    i <= current ? "bg-success" : "bg-border",
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative grid size-7 place-items-center rounded-full border-2 text-xs font-bold",
                  doneStep && "border-success bg-success text-success-foreground",
                  active && "border-gold bg-gold-soft text-gold-ink",
                  !doneStep && !active && "border-border bg-card text-muted-foreground",
                )}
              >
                {doneStep ? <Check className="size-4" aria-hidden="true" /> : i + 1}
                {active ? (
                  <span
                    className="absolute inset-0 animate-ping rounded-full border-2 border-gold opacity-40"
                    aria-hidden="true"
                  />
                ) : null}
              </span>
            </div>
            <span
              className={cn(
                "text-[0.7rem] font-semibold sm:text-xs",
                i <= current ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {t(`steps.${step}`)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
