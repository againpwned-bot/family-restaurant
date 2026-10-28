import { cn } from "@/lib/utils";

export function LogoMark({ className, still = false }: { className?: string; still?: boolean }) {
  const wisps = ["M17 13c-2-2.6 2-4.4 0-7", "M24 12.5c-2-3.5 2-5.5 0-8.5", "M31 13c-2-2.6 2-4.4 0-7"];
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={cn("size-8 overflow-visible", className)}>
      <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity="0.75">
        {wisps.map((d, i) => (
          <path
            key={d}
            d={d}
            data-anim={still ? undefined : "loop"}
            className={still ? undefined : "animate-steam"}
            style={
              still
                ? undefined
                : { animationDelay: `${i * 0.55}s`, transformBox: "fill-box", transformOrigin: "50% 100%" }
            }
          />
        ))}
      </g>
      <path d="M5 21h38a2 2 0 0 1 2 2.2C44 33.6 35 42 24 42S4 33.6 3 23.2A2 2 0 0 1 5 21Z" fill="currentColor" />
      <path d="M15 46h18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ name, className }: { name: string; className?: string }) {
  const [first, ...rest] = name.split(" ");
  return (
    <span className={cn("group/wordmark inline-flex items-center gap-2.5", className)}>
      <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground sticker-sm group-hover/wordmark:animate-wiggle">
        <LogoMark className="size-6" />
      </span>
      <span className="font-heading text-xl leading-none font-bold tracking-tight [font-variation-settings:'SOFT'_100,'WONK'_1]">
        {first} <em className="font-semibold text-brand-ink italic">{rest.join(" ")}</em>
      </span>
    </span>
  );
}
