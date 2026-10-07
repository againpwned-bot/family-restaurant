"use client";

import { LazyMotion, domAnimation } from "motion/react";
import { useEffect, type ReactNode } from "react";

import { installAudioUnlock } from "@/lib/sound";

// LazyMotion + domAnimation keeps the initial motion bundle small; `strict`
// makes any accidental `motion.*` (instead of `m.*`) throw in development.
// Per-tier MotionConfig lives in AnimationProvider.
export function MotionProvider({ children }: { children: ReactNode }) {
  // Browsers only allow sound after a user gesture; listen app-wide so the
  // tap on "Intră în cont" already unlocks the order chimes.
  useEffect(() => installAudioUnlock(), []);
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}
