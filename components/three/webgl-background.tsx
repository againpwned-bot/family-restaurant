"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { useAnimation } from "@/components/providers/animation-provider";

// three.js + react-three-fiber are only ever fetched by desktop-full devices,
// and only once the page is idle (they never compete with the first paint / LCP).
const Steam = dynamic(() => import("@/components/three/steam"), { ssr: false });

export function WebglBackground({
  className,
  color,
  opacity,
  additive,
}: {
  className?: string;
  color?: string;
  opacity?: number;
  additive?: boolean;
}) {
  const { tier, settled } = useAnimation();
  const [idle, setIdle] = useState(false);

  // After the first-seconds frame-rate check, so WebGL never skews it.
  useEffect(() => {
    if (tier !== "full" || !settled) return;
    const schedule = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = schedule(() => setIdle(true), { timeout: 2500 });
    return () => cancel(id as number);
  }, [tier, settled]);

  if (tier !== "full" || !idle) return null;
  return (
    <div aria-hidden="true" className={className}>
      <Steam className="size-full" color={color} opacity={opacity} additive={additive} />
    </div>
  );
}
