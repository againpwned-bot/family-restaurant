import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

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
      <div className="absolute inset-0 [clip-path:inset(0_0_0_50%)]">
        <div
          className={cn("absolute inset-0 rounded-full [clip-path:inset(0_50%_0_0)]", fill, turn)}
          style={{ transform: `rotate(${right}deg)` }}
        />
      </div>
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
