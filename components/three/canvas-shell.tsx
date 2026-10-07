"use client";

// Shared <Canvas> setup for the desktop-full tier. Budget (RTX 3050 class):
// one canvas per page, dpr max 1.5, no antialias (dpr does the smoothing), no
// post-processing, a handful of draw calls. Rendering stops while the tab is
// hidden or the canvas is scrolled out of view, and a sustained frame-rate drop
// or a lost WebGL context quietly falls back to the lite tier.

import { Canvas, useFrame } from "@react-three/fiber";
import { Component, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { useAnimation } from "@/components/providers/animation-provider";
import { cn } from "@/lib/utils";

class WebglBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// "One canvas per page": when a second canvas appears (e.g. the dish overlay's
// 3D plate over the home page's background), the older ones stop rendering
// until it goes away.
let nextId = 0;
const stack: number[] = [];
const listeners = new Set<() => void>();
function useIsTopCanvas() {
  const [id] = useState(() => ++nextId);
  const [top, setTop] = useState(true);
  useEffect(() => {
    stack.push(id);
    const update = () => setTop(stack[stack.length - 1] === id);
    listeners.add(update);
    listeners.forEach((l) => l());
    return () => {
      stack.splice(stack.indexOf(id), 1);
      listeners.delete(update);
      listeners.forEach((l) => l());
    };
  }, [id]);
  return top;
}

/** Measures the canvas' own frame rate; below 45 fps for two 3 s windows in a row -> give up WebGL. */
function FpsGuard({ onSlow }: { onSlow: () => void }) {
  const acc = useRef({ time: 0, frames: 0, warmup: 1.5, reported: false, slow: 0 });
  useFrame((_, delta) => {
    const a = acc.current;
    if (a.reported) return;
    if (a.warmup > 0) {
      a.warmup -= delta;
      return;
    }
    a.time += delta;
    a.frames++;
    if (a.time >= 3) {
      // One-off hitches (navigation, texture upload) don't count: it must stay slow.
      a.slow = a.frames / a.time < 45 ? a.slow + 1 : 0;
      if (a.slow >= 2) {
        a.reported = true;
        onSlow();
      }
      a.time = 0;
      a.frames = 0;
    }
  });
  return null;
}

export function CanvasShell({
  children,
  className,
  frameloop = "always",
  camera,
  label,
}: {
  children: ReactNode;
  className?: string;
  frameloop?: "always" | "demand";
  camera?: { position: [number, number, number]; fov?: number };
  label?: string;
}) {
  const { reportWebglFailure } = useAnimation();
  const box = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const [ready, setReady] = useState(false);
  // react-three-fiber releases the context itself on unmount (webglcontextlost
  // fires then too): only a loss while still mounted is a real GPU problem.
  const mounted = useRef(true);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    const onVisibility = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const isTop = useIsTopCanvas();
  const running = onScreen && tabVisible && isTop;

  return (
    <div
      ref={box}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      className={cn("transition-opacity duration-700", ready ? "opacity-100" : "opacity-0", className)}
    >
      <WebglBoundary onError={reportWebglFailure}>
        <Canvas
          dpr={[1, 1.5]}
          frameloop={running ? frameloop : "never"}
          camera={camera ?? { position: [0, 0, 6], fov: 45 }}
          gl={{
            antialias: false,
            alpha: true,
            powerPreference: "high-performance",
            failIfMajorPerformanceCaveat: true,
          }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener("webglcontextlost", (event) => {
              event.preventDefault();
              window.setTimeout(() => {
                if (mounted.current) reportWebglFailure();
              }, 0);
            });
            setReady(true);
          }}
        >
          {frameloop === "always" && running ? <FpsGuard onSlow={reportWebglFailure} /> : null}
          {children}
        </Canvas>
      </WebglBoundary>
    </div>
  );
}
