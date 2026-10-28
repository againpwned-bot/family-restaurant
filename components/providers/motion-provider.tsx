"use client";

import { LazyMotion, domAnimation } from "motion/react";
import { useEffect, type ReactNode } from "react";

import { installAudioUnlock } from "@/lib/sound";

export function MotionProvider({ children }: { children: ReactNode }) {
  useEffect(() => installAudioUnlock(), []);
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}
