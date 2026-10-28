"use client";

import { m, useMotionValue, useSpring, useTransform } from "motion/react";
import { useState, type PointerEvent, type ReactNode } from "react";

import { useAnimation } from "@/components/providers/animation-provider";
import { cn } from "@/lib/utils";

const SPRING = { stiffness: 180, damping: 22, mass: 0.6 };

export function TiltSurface({
  children,
  className,
  enabled = true,
  maxTilt = 7,
}: {
  children: ReactNode;
  className?: string;
  enabled?: boolean;
  maxTilt?: number;
}) {
  const { tier } = useAnimation();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const glare = useMotionValue(0);
  const rotateY = useSpring(
    useTransform(px, (v) => v * maxTilt * 2),
    SPRING,
  );
  const rotateX = useSpring(
    useTransform(py, (v) => -v * maxTilt * 2),
    SPRING,
  );
  const glareOpacity = useSpring(glare, { stiffness: 200, damping: 26 });
  const glareX = useTransform(px, (v) => `${v * 60}%`);
  const glareY = useTransform(py, (v) => `${v * 60}%`);
  const [active, setActive] = useState(false);

  const mode = !enabled || tier === "reduced" ? "off" : tier === "full" ? "hover" : "press";

  const track = (event: PointerEvent<HTMLDivElement>, strength = 1) => {
    const rect = event.currentTarget.getBoundingClientRect();
    px.set(((event.clientX - rect.left) / rect.width - 0.5) * strength);
    py.set(((event.clientY - rect.top) / rect.height - 0.5) * strength);
  };
  const reset = () => {
    px.set(0);
    py.set(0);
    glare.set(0);
    setActive(false);
  };

  if (mode === "off") return <div className={className}>{children}</div>;

  return (
    <m.div
      className={cn("relative touch-manipulation", active && "will-change-transform", className)}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      onPointerEnter={(e) => {
        if (mode === "hover" && e.pointerType === "mouse") setActive(true);
      }}
      onPointerMove={(e) => {
        if (mode === "hover" && e.pointerType === "mouse") {
          track(e);
          glare.set(1);
        }
      }}
      onPointerLeave={reset}
      onPointerDown={(e) => {
        if (mode === "press" || e.pointerType !== "mouse") {
          setActive(true);
          track(e, 0.6);
        }
      }}
      onPointerUp={() => mode === "press" && reset()}
      onPointerCancel={reset}
    >
      {children}
      {mode === "hover" ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[inherit]">
          <m.div
            className="absolute -inset-1/2 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.32),transparent_42%)]"
            style={{ x: glareX, y: glareY, opacity: glareOpacity }}
          />
        </div>
      ) : null}
    </m.div>
  );
}
