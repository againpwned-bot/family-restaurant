"use client";

import { Box, ImageIcon } from "lucide-react";
import { m } from "motion/react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { DishPhoto } from "@/components/dish/dish-photo";
import { useAnimation } from "@/components/providers/animation-provider";
import { cn } from "@/lib/utils";

const DishPlate3D = dynamic(() => import("@/components/three/dish-plate").then((mod) => mod.DishPlate3D), {
  ssr: false,
});

type HeroDish = { id: string; name: string; photo_path: string | null; photo_blur: string | null };

export function DishHero({ dish, rounded = true }: { dish: HeroDish; rounded?: boolean }) {
  const t = useTranslations("dish");
  const { tier, settled } = useAnimation();
  const [view, setView] = useState<"photo" | "3d">("3d");
  const can3d = tier === "full" && !!dish.photo_path;
  const show3d = can3d && settled && view === "3d";

  return (
    <div className="relative">
      <m.div
        layoutId={`dish-photo-${dish.id}`}
        className={cn(
          "relative aspect-[4/3] overflow-hidden bg-muted",
          rounded && "sm:rounded-[2rem] sm:border-2 sm:border-line sm:shadow-[6px_6px_0_var(--shadow-hard)]",
        )}
      >
        <DishPhoto dish={dish} preload sizes="(min-width: 1024px) 55vw, 100vw" />
        {show3d ? <DishPlate3D photoPath={dish.photo_path!} name={dish.name} /> : null}
      </m.div>
      {can3d ? (
        <div
          role="radiogroup"
          aria-label={t("view3d")}
          className="absolute top-3 right-3 z-10 flex rounded-full border-2 border-line bg-card/95 p-1"
        >
          {(["3d", "photo"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={view === v}
              onClick={() => setView(v)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {v === "3d" ? (
                <Box className="size-3.5" aria-hidden="true" />
              ) : (
                <ImageIcon className="size-3.5" aria-hidden="true" />
              )}
              {v === "3d" ? t("view3d") : t("viewPhoto")}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
