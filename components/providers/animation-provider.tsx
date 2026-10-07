"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  TIER_ORDER,
  detectTier,
  downgradeFor,
  measureFps,
  resolveTier,
  type AnimationPref,
  type AnimationTier,
} from "@/lib/animation/tier";

type Stored = { tier: AnimationTier; renderer?: string; pinned?: boolean };

type AnimationContextValue = {
  /** What the UI should do right now. */
  tier: AnimationTier;
  pref: AnimationPref;
  /** What this device was detected as (null until measured). */
  detected: AnimationTier | null;
  renderer: string | null;
  setPref: (pref: AnimationPref) => Promise<void>;
  /** WebGL context lost / unavailable: fall back to lite without a fuss. */
  reportWebglFailure: () => void;
  /** True once the first-seconds frame-rate check is over (heavy prefetches wait for it). */
  settled: boolean;
};

const AnimationContext = createContext<AnimationContextValue>({
  tier: "lite",
  pref: "auto",
  detected: null,
  renderer: null,
  setPref: async () => {},
  reportWebglFailure: () => {},
  settled: false,
});

export const useAnimation = () => useContext(AnimationContext);

// Layout / shared-element animations (layoutId) need motion's domMax features;
// they're loaded after hydration so they never delay the first paint.
const loadDomMax = () => import("@/lib/motion-features").then((m) => m.default);

// supabase-js is only needed to save preferences; keep it out of the first load
// (the login page doesn't otherwise need it).
const supabase = () => import("@/lib/supabase/client").then((m) => m.getSupabaseBrowserClient());

function read(key: string): Stored | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: Stored | null) {
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
  } catch {
    // storage unavailable: detection simply runs again next time
  }
}

export function AnimationProvider({
  userId,
  initialPref,
  initialDetected = null,
  children,
}: {
  userId: string | null;
  initialPref: AnimationPref;
  /** What the profile already has stored (skip the write when unchanged). */
  initialDetected?: AnimationTier | null;
  children: ReactNode;
}) {
  const t = useTranslations("animations");
  const [pref, setPrefState] = useState<AnimationPref>(initialPref);
  const [detected, setDetected] = useState<AnimationTier | null>(null);
  const [renderer, setRenderer] = useState<string | null>(null);
  const [webglBroken, setWebglBroken] = useState(false);
  const [settled, setSettled] = useState(false);
  const key = `anim-tier:${userId ?? "anon"}`;
  const prefRef = useRef(pref);
  useEffect(() => {
    prefRef.current = pref;
  }, [pref]);

  // Detect once per page load (next frame, off the hydration path); a slow
  // device's earlier downgrade sticks.
  useEffect(() => {
    let cancelled = false;
    let idleHandle = 0;
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
    const frame = requestAnimationFrame(() => {
      const stored = read(key);
      const fresh = detectTier();
      let tier = fresh.tier;
      if (stored && fresh.tier !== "reduced" && TIER_ORDER.indexOf(stored.tier) > TIER_ORDER.indexOf(tier)) {
        tier = stored.tier;
      }
      setDetected(tier);
      setRenderer(fresh.gpu?.renderer || null);
      write(key, { ...stored, tier, renderer: fresh.gpu?.renderer });

      // Measure the first 3 seconds after the page is interactive.
      idleHandle = idle(async () => {
        if (cancelled) return;
        if (stored?.pinned || tier === "reduced") return setSettled(true);
        const fps = await measureFps(3000);
        if (cancelled) return;
        setSettled(true);
        if (prefRef.current !== "auto") return;
        const lower = downgradeFor(tier, fps);
        if (!lower) return;
        const previous = tier;
        setDetected(lower);
        write(key, { tier: lower, renderer: fresh.gpu?.renderer });
        toast(t("downgraded"), {
          duration: 8000,
          action: {
            label: t("undo"),
            onClick: () => {
              setDetected(previous);
              write(key, { tier: previous, renderer: fresh.gpu?.renderer, pinned: true });
            },
          },
        });
      }) as number;
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      (window.cancelIdleCallback ?? window.clearTimeout)(idleHandle);
    };
  }, [key, t]);

  // Remember the detected tier on the profile too (informational).
  useEffect(() => {
    if (!userId || !detected || detected === initialDetected) return;
    void supabase().then((client) => client.from("profiles").update({ animation_detected: detected }).eq("id", userId));
  }, [userId, detected, initialDetected]);

  const setPref = useCallback(
    async (next: AnimationPref) => {
      setPrefState(next);
      if (next === "auto") {
        // Start over: forget pins and earlier downgrades on this device.
        const fresh = detectTier();
        setDetected(fresh.tier);
        write(key, { tier: fresh.tier, renderer: fresh.gpu?.renderer });
      }
      if (userId) await (await supabase()).from("profiles").update({ animation_pref: next }).eq("id", userId);
    },
    [key, userId],
  );

  const reportWebglFailure = useCallback(() => setWebglBroken(true), []);

  const requested = detected === null ? "lite" : resolveTier(pref, detected);
  const tier: AnimationTier = requested === "full" && webglBroken ? "lite" : requested;

  useEffect(() => {
    document.documentElement.dataset.tier = tier;
  }, [tier]);

  const value = useMemo(
    () => ({ tier, pref, detected, renderer, setPref, reportWebglFailure, settled }),
    [tier, pref, detected, renderer, setPref, reportWebglFailure, settled],
  );

  return (
    <AnimationContext value={value}>
      <MotionConfig
        reducedMotion={tier === "reduced" ? "always" : "user"}
        transition={
          tier === "reduced" ? { duration: 0.15, ease: "easeOut" } : { type: "spring", stiffness: 170, damping: 24 }
        }
      >
        <LazyMotion features={loadDomMax}>{children}</LazyMotion>
      </MotionConfig>
    </AnimationContext>
  );
}
