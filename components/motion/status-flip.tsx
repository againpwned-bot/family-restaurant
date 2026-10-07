"use client";

import { AnimatePresence, m } from "motion/react";
import type { ReactNode } from "react";

import { useAnimation } from "@/components/providers/animation-provider";

/** When an order advances, its status flips forward in 3D (fade only when reduced). */
export function StatusFlip({
  statusKey,
  children,
  className,
}: {
  statusKey: string;
  children: ReactNode;
  className?: string;
}) {
  const { tier } = useAnimation();
  const flat = tier === "reduced";
  return (
    <div className={className} style={flat ? undefined : { perspective: 600 }}>
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={statusKey}
          initial={flat ? { opacity: 0 } : { opacity: 0, rotateX: -75, y: 6 }}
          animate={flat ? { opacity: 1 } : { opacity: 1, rotateX: 0, y: 0 }}
          exit={flat ? { opacity: 0 } : { opacity: 0, rotateX: 75, y: -6, transition: { duration: 0.16 } }}
          transition={flat ? { duration: 0.15 } : { type: "spring", stiffness: 200, damping: 22 }}
          style={{ transformOrigin: "50% 50% -12px" }}
        >
          {children}
        </m.div>
      </AnimatePresence>
    </div>
  );
}
