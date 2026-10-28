"use client";

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
