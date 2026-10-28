"use client";

import { m, useScroll, useTransform } from "motion/react";
import type { ReactNode } from "react";

import { useAnimation } from "@/components/providers/animation-provider";

export function ScrollParallax({
  children,
  speed = 0.25,
  fade = false,
  className,
}: {
  children: ReactNode;
  speed?: number;
  fade?: boolean;
  className?: string;
}) {
  const { tier } = useAnimation();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, (v) => Math.min(v, 600) * speed);
  const opacity = useTransform(scrollY, [0, 320], [1, fade ? 0.35 : 1]);
  if (tier !== "full") return <div className={className}>{children}</div>;
  return (
    <m.div className={className} style={{ y, opacity }}>
      {children}
    </m.div>
  );
}
