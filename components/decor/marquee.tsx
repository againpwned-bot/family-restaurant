import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

export function Marquee({ items, className, label }: { items: string[]; className?: string; label?: string }) {
  if (!items.length) return null;
  const copy = Array.from({ length: Math.max(1, Math.ceil(8 / items.length)) }, () => items).flat();
  const run = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {copy.map((item, i) => (
        <li key={i} className="flex items-center gap-5 pr-5 whitespace-nowrap">
          <span className="font-heading text-lg font-semibold italic sm:text-xl">{item}</span>
          <span className="text-gold" aria-hidden="true">
            ✻
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div
      role={label ? "region" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "marquee relative -rotate-1 overflow-hidden border-y-2 border-line bg-foreground py-2.5 text-background",
        className,
      )}
    >
      <div
        data-marquee-track=""
        data-anim="loop"
        className="flex w-max animate-marquee"
        style={{ "--marquee-dur": `${Math.max(24, copy.length * 4)}s` } as CSSProperties}
      >
        {run(false)}
        {run(true)}
      </div>
    </div>
  );
}
