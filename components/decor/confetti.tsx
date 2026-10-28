"use client";

import { m } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import { useAnimation } from "@/components/providers/animation-provider";

const COLORS = ["var(--primary)", "var(--gold)", "var(--olive)", "var(--line)", "#f0a58f"];
const PIECES = 34;

export function Confetti({ shot }: { shot: number | string | null | false }) {
  const { tier } = useAnimation();
  const [live, setLive] = useState<number | string | null>(null);

  useEffect(() => {
    if (!shot || tier === "reduced") return;
    const start = setTimeout(() => setLive(shot), 0);
    const stop = setTimeout(() => setLive(null), 2200);
    return () => {
      clearTimeout(start);
      clearTimeout(stop);
    };
  }, [shot, tier]);

  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => {
        const angle = (i / PIECES) * Math.PI * 2 + ((i * 37) % 11) / 10;
        const dist = 90 + ((i * 53) % 90);
        return {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist * 0.75 - 40,
          fall: 120 + ((i * 29) % 80),
          rotate: ((i * 97) % 720) - 360,
          color: COLORS[i % COLORS.length],
          round: i % 3 === 0,
          w: 6 + (i % 4) * 2,
          delay: (i % 6) * 0.015,
        };
      }),
    [],
  );

  if (!live) return null;
  return (
    <div aria-hidden="true" key={String(live)} className="pointer-events-none absolute inset-0 z-30 overflow-visible">
      {pieces.map((p, i) => (
        <m.span
          key={i}
          className="absolute top-1/2 left-1/2 block"
          style={{
            width: p.w,
            height: p.round ? p.w : p.w * 1.8,
            background: p.color,
            borderRadius: p.round ? 999 : 2,
          }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 0.4 }}
          animate={{
            x: [0, p.x, p.x * 1.15],
            y: [0, p.y, p.y + p.fall],
            rotate: [0, p.rotate / 2, p.rotate],
            opacity: [1, 1, 0],
            scale: [0.4, 1, 0.9],
          }}
          transition={{ duration: 1.7, ease: [0.16, 0.84, 0.44, 1], delay: p.delay, times: [0, 0.35, 1] }}
        />
      ))}
    </div>
  );
}
