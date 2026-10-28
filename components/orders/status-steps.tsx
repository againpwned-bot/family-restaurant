"use client";

import { Check } from "lucide-react";
import { m } from "motion/react";
import { useTranslations } from "next-intl";

import { useSkipEntrance } from "@/hooks/use-entrance";
import type { OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS = ["received", "accepted", "cooking", "ready"] as const;
const SPRING = { type: "spring", stiffness: 260, damping: 20 } as const;

export function StatusSteps({ status, className }: { status: OrderStatus; className?: string }) {
  const t = useTranslations("orders");
  const skip = useSkipEntrance();
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
                <span className="absolute top-1/2 right-1/2 h-1 w-full -translate-y-1/2 overflow-hidden rounded-full bg-border">
                  <m.span
                    className="absolute inset-0 origin-left rounded-full bg-success"
                    initial={skip ? false : { scaleX: 0 }}
                    animate={{ scaleX: i <= current ? 1 : 0 }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
                  />
                </span>
              ) : null}
              <m.span
                animate={{ scale: active ? 1.12 : 1 }}
                transition={SPRING}
                className={cn(
                  "relative grid size-8 place-items-center rounded-full border-2 text-xs font-extrabold",
                  doneStep && "border-line bg-success text-success-foreground",
                  active && "border-line bg-gold text-gold-foreground shadow-[2px_2px_0_var(--shadow-hard)]",
                  !doneStep && !active && "border-border bg-card text-muted-foreground",
                )}
              >
                {doneStep ? (
                  <m.span
                    key="done"
                    initial={skip ? false : { scale: 0, rotate: -120 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ ...SPRING, delay: 0.45 }}
                    className="grid place-items-center"
                  >
                    <Check className="size-4" strokeWidth={3.5} aria-hidden="true" />
                  </m.span>
                ) : (
                  i + 1
                )}
                {active ? (
                  <span
                    className="absolute -inset-1 animate-ping rounded-full border-2 border-gold opacity-50"
                    aria-hidden="true"
                  />
                ) : null}
              </m.span>
            </div>
            <span
              className={cn(
                "text-[0.7rem] font-bold sm:text-xs",
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
