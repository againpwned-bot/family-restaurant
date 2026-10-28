import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between lg:mb-8", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 inline-block origin-left -rotate-2 font-hand text-2xl leading-none font-bold text-brand-ink">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-heading text-4xl leading-[0.95] font-black tracking-[-0.02em] [font-variation-settings:'SOFT'_100,'WONK'_1,'opsz'_144] sm:text-5xl">
          {title}
        </h1>
        {description ? <p className="mt-2.5 max-w-2xl text-base text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
