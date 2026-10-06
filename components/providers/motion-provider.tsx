"use client";

import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import type { ReactNode } from "react";

// LazyMotion + domAnimation keeps the initial motion bundle small; `strict`
// makes any accidental `motion.*` (instead of `m.*`) throw in development.
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 170, damping: 24 }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
