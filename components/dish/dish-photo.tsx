import Image from "next/image";
import type { CSSProperties } from "react";

import { dishPhotoUrl } from "@/lib/photos";
import { cn } from "@/lib/utils";

const CLOTHS = ["#b8321a", "#d9901a", "#5b6e2a", "#7d3c5a", "#2f6f73"];

function clothFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return CLOTHS[hash % CLOTHS.length];
}

export type DishPhotoSource = {
  name: string;
  photo_path: string | null;
  photo_blur?: string | null;
};

export function DishPhoto({
  dish,
  sizes,
  preload = false,
  className,
  quality = 75,
}: {
  dish: DishPhotoSource;
  sizes: string;
  preload?: boolean;
  className?: string;
  quality?: 60 | 75;
}) {
  const src = dishPhotoUrl(dish.photo_path);
  if (!src) return <DishPlaceholder name={dish.name} className={className} />;
  return (
    <Image
      src={src}
      alt={dish.name}
      fill
      sizes={sizes}
      quality={quality}
      preload={preload}
      placeholder={dish.photo_blur ? (dish.photo_blur as `data:image/${string}`) : "empty"}
      className={cn("object-cover", className)}
    />
  );
}

export function DishPlaceholder({ name, className }: { name: string; className?: string }) {
  const cloth = clothFor(name);
  return (
    <div
      role="img"
      aria-label={name}
      className={cn("absolute inset-0 overflow-hidden [container-type:size]", className)}
      style={{ "--cloth": cloth } as CSSProperties}
    >
      <div className="absolute inset-0 gingham" style={{ backgroundSize: "18cqmax 18cqmax" }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(29,25,21,0.28))]" />
      <div className="absolute top-1/2 left-1/2 aspect-square h-[72cqmin] -translate-x-1/2 -translate-y-[44%] transition-transform duration-700 ease-[var(--ease-bounce)] group-hover/dish:-translate-y-[50%] group-hover/dish:rotate-[18deg]">
        <div className="absolute inset-0 rounded-full border-[max(2px,0.8cqmin)] border-[#1d1915] bg-[#fffdf7] shadow-[1.6cqmin_2.2cqmin_0_rgba(29,25,21,0.35)]" />
        <div className="absolute inset-[14%] rounded-full border-[max(1px,0.5cqmin)] border-dashed border-[#1d1915]/30" />
        <span
          className="absolute inset-0 grid place-items-center pb-[4%] font-heading text-[34cqmin] leading-none font-black italic [font-variation-settings:'SOFT'_100,'WONK'_1]"
          style={{ color: cloth }}
        >
          {name.trim().charAt(0).toUpperCase()}
        </span>
      </div>
      <svg
        viewBox="0 0 60 30"
        aria-hidden="true"
        className="absolute top-[3%] left-1/2 h-[22cqmin] -translate-x-1/2 overflow-visible text-[#fffdf7]"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      >
        {["M18 28c-4-5 4-8 0-14", "M30 28c-4-6 4-10 0-17", "M42 28c-4-5 4-8 0-14"].map((d, i) => (
          <path
            key={d}
            d={d}
            data-anim="loop"
            className="animate-steam"
            style={{ animationDelay: `${i * 0.8}s`, transformBox: "fill-box", transformOrigin: "50% 100%" }}
          />
        ))}
      </svg>
    </div>
  );
}

export function placeholderDataUrl(name: string): string {
  const cloth = clothFor(name);
  const letter = name
    .trim()
    .charAt(0)
    .toUpperCase()
    .replace(/[<&>"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 580 400"><defs><pattern id="g" width="56" height="56" patternUnits="userSpaceOnUse"><rect width="56" height="56" fill="#fffaf2"/><rect width="56" height="56" fill="${cloth}" opacity=".18"/><rect width="28" height="56" fill="${cloth}" opacity=".55"/><rect width="56" height="28" fill="${cloth}" opacity=".55"/></pattern><radialGradient id="v"><stop offset=".45" stop-color="#1d1915" stop-opacity="0"/><stop offset="1" stop-color="#1d1915" stop-opacity=".3"/></radialGradient></defs><rect width="580" height="400" fill="url(#g)"/><rect width="580" height="400" fill="url(#v)"/><circle cx="300" cy="230" r="140" fill="#1d1915" opacity=".3"/><circle cx="290" cy="215" r="140" fill="#fffdf7" stroke="#1d1915" stroke-width="5"/><circle cx="290" cy="215" r="108" fill="none" stroke="#1d1915" stroke-opacity=".3" stroke-width="3" stroke-dasharray="10 10"/><text x="290" y="262" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="150" font-weight="700" fill="${cloth}">${letter}</text><g fill="none" stroke="#fffdf7" stroke-width="8" stroke-linecap="round"><path d="M250 62c-10-14 10-22 0-38"/><path d="M290 66c-10-16 10-26 0-46"/><path d="M330 62c-10-14 10-22 0-38"/></g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
