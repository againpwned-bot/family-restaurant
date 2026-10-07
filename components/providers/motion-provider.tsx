"use client";

import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import { useEffect, type ReactNode } from "react";

import { installAudioUnlock } from "@/lib/sound";

// LazyMotion + domAnimation keeps the initial motion bundle small; `strict`
// makes any accidental `motion.*` (instead of `m.*`) throw in development.
export function MotionProvider({ children }: { children: ReactNode }) {
  // Browsers only allow sound after a user gesture; listen app-wide so the
  // tap on "Intră în cont" already unlocks the order chimes.
  useEffect(() => installAudioUnlock(), []);
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 170, damping: 24 }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
