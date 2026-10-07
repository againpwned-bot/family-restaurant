import Image from "next/image";

import { LogoMark } from "@/components/brand/logo";
import { dishPhotoUrl } from "@/lib/env";
import { cn } from "@/lib/utils";

// Warm placeholder tints, picked from the dish name so each dish keeps its colour.
const TINTS = [
  "from-[#f87171] to-[#b91c1c]",
  "from-[#fbbf24] to-[#b45309]",
  "from-[#fb923c] to-[#c2410c]",
  "from-[#f472b6] to-[#be123c]",
  "from-[#a3e635] to-[#4d7c0f]",
];

function tintFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[hash % TINTS.length];
}

export type DishPhotoSource = {
  name: string;
  photo_path: string | null;
  photo_blur?: string | null;
};

/**
 * Dish photo through next/image (AVIF/WebP, responsive `sizes`, lazy by
 * default) with the stored blur preview as placeholder. Fills its parent,
 * which must be `relative` with a fixed aspect ratio (no layout shift).
 */
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
  return (
    <div
      role="img"
      aria-label={name}
      className={cn(
        "absolute inset-0 grid place-items-center bg-gradient-to-br text-white [container-type:size]",
        tintFor(name),
        className,
      )}
    >
      <LogoMark className="size-1/3 max-h-24 max-w-24 opacity-35" />
      <span className="absolute bottom-[8%] left-[8%] font-heading text-[clamp(1.5rem,9cqw,4rem)] leading-none font-bold opacity-90">
        {name.trim().charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

/** SVG data URL version of the placeholder, for places that need a plain <img> src. */
export function placeholderDataUrl(name: string): string {
  const palette = [
    ["#f87171", "#b91c1c"],
    ["#fbbf24", "#b45309"],
    ["#fb923c", "#c2410c"],
    ["#f472b6", "#be123c"],
    ["#a3e635", "#4d7c0f"],
  ];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const [a, b] = palette[hash % palette.length];
  const letter = name
    .trim()
    .charAt(0)
    .toUpperCase()
    .replace(/[<&>"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 580 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="580" height="400" fill="url(#g)"/><g fill="#fff" opacity=".3" transform="translate(222 132) scale(3)"><path d="M5 21h38a2 2 0 0 1 2 2.2C44 33.6 35 42 24 42S4 33.6 3 23.2A2 2 0 0 1 5 21Z"/><path d="M15 46h18" stroke="#fff" stroke-width="3" stroke-linecap="round"/></g><text x="36" y="360" font-family="Georgia,serif" font-size="120" font-weight="700" fill="#fff" opacity=".9">${letter}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
