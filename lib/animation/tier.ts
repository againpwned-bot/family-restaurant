import type { AnimationPref, AnimationTier } from "@/lib/types";

export type { AnimationPref, AnimationTier };

export const TIER_ORDER: AnimationTier[] = ["full", "lite", "reduced"];

const SOFTWARE_RENDERER =
  /swiftshader|llvmpipe|softpipe|lavapipe|microsoft basic render|software|mesa offscreen|gdi generic|virtualbox|vmware svga/i;

export type GpuInfo = { webgl: boolean; renderer: string; software: boolean };

export function gpuInfo(): GpuInfo {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return { webgl: false, renderer: "", software: true };
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return { webgl: true, renderer, software: SOFTWARE_RENDERER.test(renderer) };
  } catch {
    return { webgl: false, renderer: "", software: true };
  }
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function detectTier(): { tier: AnimationTier; gpu: GpuInfo | null } {
  if (prefersReducedMotion()) return { tier: "reduced", gpu: null };
  const desktop = window.matchMedia("(pointer: fine) and (hover: hover)").matches && window.innerWidth >= 1024;
  if (!desktop) return { tier: "lite", gpu: null };
  const gpu = gpuInfo();
  return { tier: gpu.webgl && !gpu.software ? "full" : "lite", gpu };
}

export function measureFps(ms = 3000): Promise<number> {
  return new Promise((resolve) => {
    let frames = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      frames++;
      if (now - start >= ms) resolve((frames - 1) / ((now - start) / 1000));
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export function downgradeFor(tier: AnimationTier, fps: number): AnimationTier | null {
  if (tier === "full" && fps < 50) return "lite";
  if (tier === "lite" && fps < 45) return "reduced";
  return null;
}

export function resolveTier(pref: AnimationPref, detected: AnimationTier): AnimationTier {
  if (pref === "auto") return detected;
  return pref;
}
