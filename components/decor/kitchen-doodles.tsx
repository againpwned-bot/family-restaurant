import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

export const DOODLES = {
  whisk: "M24 4v14M24 18c-8 4-10 18 0 26 10-8 8-22 0-26M24 18c-4 4-5 16 0 26M24 18c4 4 5 16 0 26",
  chili: "M33 7c-2 1-3 3-3 6M27 13c7-1 10 5 8 11-3 9-14 16-25 17 8-5 12-12 13-19 1-5 1-8 4-9Z",
  leaf: "M8 40C8 20 22 8 40 8c0 18-12 32-32 32ZM8 40 30 18M18 30h7M24 24v-7",
  spoon: "M31 5c6 0 9 6 6 12s-9 7-12 4-3-16 6-16ZM25 21 7 43",
  garlic:
    "M24 6c-2 6-14 10-14 22 0 8 6 12 14 12s14-4 14-12C38 16 26 12 24 6ZM24 15v25M17 22c-2 6-1 12 2 17M31 22c2 6 1 12-2 17",
  sparkle: "M24 6v12M24 30v12M6 24h12M30 24h12M13 13l5 5M30 30l5 5M35 13l-5 5M18 30l-5 5",
  fork: "M17 4v12c0 4 3 6 7 6s7-2 7-6V4M24 4v11M24 22v22",
  pot: "M8 19h32v15c0 5-4 8-8 8H16c-4 0-8-3-8-8V19ZM3 19h42M20 13h8M16 8c-1-2 1-3 0-5M24 8c-1-2 1-3 0-5M32 8c-1-2 1-3 0-5",
} as const;

export type DoodleName = keyof typeof DOODLES;

export function Doodle({ name, className, style }: { name: DoodleName; className?: string; style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      className={cn("size-12", className)}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={DOODLES[name]} />
    </svg>
  );
}

type Spot = {
  name: DoodleName;
  top: string;
  left: string;
  size: number;
  dur: number;
  delay: number;
  r0: number;
  phone?: boolean;
};

const SPOTS: Spot[] = [
  { name: "whisk", top: "9%", left: "4%", size: 78, dur: 19, delay: 0, r0: -18, phone: true },
  { name: "chili", top: "22%", left: "88%", size: 64, dur: 23, delay: -4, r0: 24, phone: true },
  { name: "leaf", top: "48%", left: "2%", size: 58, dur: 21, delay: -9, r0: 8 },
  { name: "sparkle", top: "6%", left: "62%", size: 34, dur: 14, delay: -2, r0: 0, phone: true },
  { name: "spoon", top: "68%", left: "92%", size: 80, dur: 25, delay: -12, r0: -30 },
  { name: "garlic", top: "82%", left: "8%", size: 60, dur: 22, delay: -6, r0: 12, phone: true },
  { name: "fork", top: "40%", left: "76%", size: 52, dur: 27, delay: -15, r0: 20 },
  { name: "pot", top: "90%", left: "55%", size: 70, dur: 24, delay: -3, r0: -6 },
  { name: "sparkle", top: "60%", left: "40%", size: 26, dur: 16, delay: -8, r0: 0 },
];

export function KitchenDoodles({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none fixed inset-0 -z-10 overflow-hidden", className)}>
      {SPOTS.map((spot, i) => (
        <Doodle
          key={i}
          name={spot.name}
          className={cn(
            "absolute animate-drift text-foreground/[0.09] will-change-transform dark:text-foreground/[0.13]",
            !spot.phone && "max-sm:hidden",
          )}
          style={
            {
              top: spot.top,
              left: spot.left,
              width: spot.size,
              height: spot.size,
              "--dur": `${spot.dur}s`,
              "--r0": `${spot.r0}deg`,
              "--dx": `${10 + (i % 3) * 6}px`,
              "--dy": `${14 + (i % 4) * 5}px`,
              animationDelay: `${spot.delay}s`,
            } as CSSProperties
          }
          {...{ "data-anim": "loop", "data-drift": "" }}
        />
      ))}
    </div>
  );
}
