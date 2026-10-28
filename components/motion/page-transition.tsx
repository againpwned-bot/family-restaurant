"use client";

import { m } from "motion/react";
import type { ReactNode } from "react";

import { useAnimation } from "@/components/providers/animation-provider";
import { useSkipEntrance } from "@/hooks/use-entrance";

export function PageTransition({ children }: { children: ReactNode }) {
  const { tier } = useAnimation();
  const skip = useSkipEntrance();
  if (tier === "reduced") {
    return (
      <m.div initial={skip ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
        {children}
      </m.div>
    );
  }
  return (
    <m.div
      initial={skip ? false : { opacity: 0, y: tier === "full" ? 18 : 10, scale: tier === "full" ? 0.995 : 1 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 170, damping: 24 }}
    >
      {children}
    </m.div>
  );
}
