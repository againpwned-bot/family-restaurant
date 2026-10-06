import { cn } from "@/lib/utils";

/** Brand mark: a steaming bowl. Inherits the text colour. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={cn("size-8", className)}>
      <path
        d="M17 6c-2 2.6 2 4.4 0 7M24 4c-2 3 2 5 0 8.5M31 6c-2 2.6 2 4.4 0 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.75"
      />
      <path d="M5 21h38a2 2 0 0 1 2 2.2C44 33.6 35 42 24 42S4 33.6 3 23.2A2 2 0 0 1 5 21Z" fill="currentColor" />
      <path d="M15 46h18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-heading text-lg font-semibold tracking-tight", className)}>
      <LogoMark className="size-7 text-primary" />
      <span>{name}</span>
    </span>
  );
}
