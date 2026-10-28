import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

export function HeroTitle({
  text,
  as: Tag = "h1",
  id,
  className,
  accentClassName,
}: {
  text: string;
  as?: "h1" | "h2";
  id?: string;
  className?: string;
  accentClassName?: string;
}) {
  const words = text.trim().split(/\s+/);
  let index = 0;

  return (
    <Tag
      id={id}
      aria-label={text}
      className={cn(
        "font-heading [line-height:0.92] font-black tracking-[-0.03em] [font-variation-settings:'SOFT'_100,'WONK'_1,'opsz'_144]",
        className,
      )}
    >
      {words.map((word, w) => {
        const accent = w === words.length - 1 && words.length > 1;
        const letters = [...word].map((ch) => {
          const i = index++;
          return (
            <span
              key={i}
              aria-hidden="true"
              className="letter-rise"
              style={{ "--i": i, "--tilt": `${i % 2 ? -10 : 9}deg` } as CSSProperties}
            >
              {ch}
            </span>
          );
        });
        return (
          <span key={w}>
            {w > 0 ? " " : null}
            <span
              aria-hidden="true"
              className={cn(
                "relative inline-block whitespace-nowrap",
                accent && "pr-[0.08em] text-primary italic",
                accent && accentClassName,
              )}
            >
              {letters}
              {accent ? (
                <svg
                  viewBox="0 0 300 24"
                  preserveAspectRatio="none"
                  className="absolute top-[0.97em] left-0 h-[0.18em] w-full overflow-visible text-gold"
                >
                  <path
                    d="M4 16C60 6 120 4 180 9s90 8 116 1"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="9"
                    strokeLinecap="round"
                    className="draw-line"
                    style={{ "--len": 320 } as CSSProperties}
                  />
                </svg>
              ) : null}
            </span>
          </span>
        );
      })}
    </Tag>
  );
}
