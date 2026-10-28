import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SpinStamp({ text, children, className }: { text: string; children?: ReactNode; className?: string }) {
  const id = `stamp-${text.length}-${text.charCodeAt(0)}`;
  return (
    <div
      aria-hidden="true"
      className={cn(
        "spin-stamp relative grid size-36 shrink-0 place-items-center rounded-full bg-gold text-gold-foreground sticker",
        className,
      )}
    >
      <svg viewBox="0 0 200 200" className="absolute inset-0 size-full animate-spin-slow" data-anim="loop">
        <defs>
          <path id={id} d="M100 100m-74 0a74 74 0 1 1 148 0a74 74 0 1 1-148 0" />
        </defs>
        <text className="fill-current font-sans text-[19px] font-extrabold tracking-[0.2em] uppercase">
          <textPath href={`#${id}`} textLength="462">
            {text}
          </textPath>
        </text>
      </svg>
      <div className="relative grid size-[52%] place-items-center rounded-full border-2 border-dashed border-current text-center">
        {children}
      </div>
    </div>
  );
}
