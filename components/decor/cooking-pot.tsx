import { cn } from "@/lib/utils";

export function CookingPot({ className, flame = true }: { className?: string; flame?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn("size-16 overflow-visible", className)}>
      <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" opacity="0.6">
        {["M22 18c-3-3 3-5 0-9", "M32 17c-3-4 3-6 0-11", "M42 18c-3-3 3-5 0-9"].map((d, i) => (
          <path
            key={d}
            d={d}
            data-anim="loop"
            className="animate-steam"
            style={{ animationDelay: `${i * 0.7}s`, transformBox: "fill-box", transformOrigin: "50% 100%" }}
          />
        ))}
      </g>
      <g className="text-gold" fill="currentColor">
        {[24, 31, 39].map((cx, i) => (
          <circle
            key={cx}
            cx={cx}
            cy="25"
            r={i === 1 ? 2.6 : 2}
            data-anim="loop"
            className="animate-bubble"
            style={{ animationDelay: `${i * 0.55}s`, transformBox: "fill-box", transformOrigin: "50% 50%" }}
          />
        ))}
      </g>
      <path d="M12 26h40v14c0 6-5 10-11 10H23c-6 0-11-4-11-10V26Z" fill="currentColor" />
      <path d="M7 27h50" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M10 33H5M54 33h5" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M18 34h28" stroke="var(--background)" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
      {flame ? (
        <g>
          {[22, 32, 42].map((x, i) => (
            <path
              key={x}
              d={`M${x} 62c-4 0-6-3-5-6 1-2 3-3 3-6 3 2 7 5 7 8 0 2-2 4-5 4Z`}
              fill={i === 1 ? "var(--gold)" : "var(--primary)"}
              data-anim="loop"
              className="animate-flicker"
              style={{ animationDelay: `${i * 0.2}s`, transformBox: "fill-box" }}
            />
          ))}
        </g>
      ) : null}
    </svg>
  );
}
