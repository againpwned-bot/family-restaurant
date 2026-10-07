import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Circular progress drawn with two rotating half-discs, so the only animated
 * property is `transform` (no stroke-dashoffset / conic-gradient repaints).
 * `progress` goes 0 -> 1 clockwise from 12 o'clock.
 */
export function TimerRing({
  progress,
  size = 72,
  thickness = 8,
  tone = "gold",
  className,
  children,
}: {
  progress: number;
  size?: number;
  thickness?: number;
  tone?: "gold" | "success" | "destructive" | "muted";
  className?: string;
  children?: ReactNode;
}) {
  const p = Math.min(1, Math.max(0, progress));
  const right = Math.min(p, 0.5) * 360;
  const left = Math.max(0, p - 0.5) * 360;
  const fill = { gold: "bg-gold", success: "bg-success", destructive: "bg-destructive", muted: "bg-muted-foreground" }[
    tone
  ];
  const turn = "transition-transform duration-1000 ease-linear";

  return (
    <div className={cn("relative shrink-0 rounded-full", className)} style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full bg-muted" />
      {/* right half: a left half-disc rotating into view */}
      <div className="absolute inset-0 [clip-path:inset(0_0_0_50%)]">
        <div
          className={cn("absolute inset-0 rounded-full [clip-path:inset(0_50%_0_0)]", fill, turn)}
          style={{ transform: `rotate(${right}deg)` }}
        />
      </div>
      {/* left half: a right half-disc, starts once the right half is full */}
      <div className="absolute inset-0 [clip-path:inset(0_50%_0_0)]">
        <div
          className={cn("absolute inset-0 rounded-full [clip-path:inset(0_0_0_50%)]", fill, turn)}
          style={{ transform: `rotate(${left}deg)` }}
        />
      </div>
      <div className="absolute rounded-full bg-card" style={{ inset: thickness }} />
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
