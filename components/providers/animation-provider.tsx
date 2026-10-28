"use client";

import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import { useTranslations } from "next-intl";
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { setAnimationDetected, setAnimationPref } from "@/app/actions/preferences";
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
  tier: AnimationTier;
  pref: AnimationPref;
  detected: AnimationTier | null;
  renderer: string | null;
  setPref: (pref: AnimationPref) => Promise<void>;
  reportWebglFailure: () => void;
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

const loadDomMax = () => import("@/lib/motion-features").then((m) => m.default);
type MotionFeatures = Parameters<typeof LazyMotion>[0]["features"];

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
  initialDetected?: AnimationTier | null;
  children: ReactNode;
}) {
  const t = useTranslations("animations");
  const [pref, setPrefState] = useState<AnimationPref>(initialPref);
  const [detected, setDetected] = useState<AnimationTier | null>(null);
  const [renderer, setRenderer] = useState<string | null>(null);
  const [webglBroken, setWebglBroken] = useState(false);
  const [settled, setSettled] = useState(false);
  const [features, setFeatures] = useState<MotionFeatures>(domAnimation);
  const key = `anim-tier:${userId ?? "anon"}`;
  const prefRef = useRef(pref);
  useEffect(() => {
    prefRef.current = pref;
  }, [pref]);

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
      startTransition(() => {
        setDetected(tier);
        setRenderer(fresh.gpu?.renderer || null);
      });
      write(key, { ...stored, tier, renderer: fresh.gpu?.renderer });

      idleHandle = idle(async () => {
        if (cancelled) return;
        if (stored?.pinned || tier === "reduced") return startTransition(() => setSettled(true));
        const fps = await measureFps(3000);
        if (cancelled) return;
        startTransition(() => setSettled(true));
        if (prefRef.current !== "auto") return;
        const lower = downgradeFor(tier, fps);
        if (!lower) return;
        const previous = tier;
        startTransition(() => setDetected(lower));
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

  useEffect(() => {
    let alive = true;
    void loadDomMax().then((bundle) => alive && startTransition(() => setFeatures(bundle)));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!userId || !detected || detected === initialDetected) return;
    void setAnimationDetected(detected).catch(() => {});
  }, [userId, detected, initialDetected]);

  const setPref = useCallback(
    async (next: AnimationPref) => {
      setPrefState(next);
      if (next === "auto") {
        const fresh = detectTier();
        setDetected(fresh.tier);
        write(key, { tier: fresh.tier, renderer: fresh.gpu?.renderer });
      }
      if (userId) await setAnimationPref(next).catch(() => {});
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
        <LazyMotion features={features}>{children}</LazyMotion>
      </MotionConfig>
    </AnimationContext>
  );
}
