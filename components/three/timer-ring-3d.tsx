"use client";

// Desktop-full order timer: a torus whose gold part grows with the elapsed
// time (fragment shader, no geometry rebuilds) and a fake bloom - an additive,
// soft radial sprite behind it, no post-processing. frameloop="demand": one
// frame per second (progress tick) or when the cursor moves.

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { CanvasShell } from "@/components/three/canvas-shell";

const ringVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const ringFragment = /* glsl */ `
  uniform float uProgress;
  uniform vec3 uFill;
  uniform vec3 uTrack;
  varying vec2 vUv;
  void main() {
    // uv.x runs once around the ring; start at 12 o'clock, go clockwise.
    float a = fract(0.25 - vUv.x);
    float lit = step(a, uProgress);
    float shade = 0.75 + 0.25 * sin(vUv.y * 6.2831);
    vec3 color = mix(uTrack, uFill * (0.85 + 0.3 * smoothstep(0.0, uProgress + 0.001, a)), lit) * shade;
    gl_FragColor = vec4(color, 1.0);
  }
`;

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.45, "rgba(255,255,255,0.25)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Ring({ progress, tone }: { progress: number; tone: "gold" | "success" | "destructive" }) {
  const invalidate = useThree((s) => s.invalidate);
  const group = useRef<THREE.Group>(null);
  const fill = tone === "success" ? "#22c55e" : tone === "destructive" ? "#ef4444" : "#eab308";

  const geometry = useMemo(() => new THREE.TorusGeometry(1.6, 0.16, 24, 160), []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uProgress: { value: 0 },
          uFill: { value: new THREE.Color(fill) },
          uTrack: { value: new THREE.Color("#7f1d1d").multiplyScalar(0.35) },
        },
        vertexShader: ringVertex,
        fragmentShader: ringFragment,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const glow = useMemo(() => {
    const m = new THREE.SpriteMaterial({
      map: glowTexture(),
      color: fill,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    material.uniforms.uProgress.value = Math.min(1, Math.max(0, progress));
    material.uniforms.uFill.value.set(fill);
    glow.color.set(fill);
    glow.opacity = 0.25 + 0.45 * progress;
    invalidate();
  }, [progress, fill, material, glow, invalidate]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      glow.map?.dispose();
      glow.dispose();
    },
    [geometry, material, glow],
  );

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const tx = -state.pointer.y * 0.25;
    const ty = state.pointer.x * 0.35;
    g.rotation.x += (tx - g.rotation.x) * 0.2;
    g.rotation.y += (ty - g.rotation.y) * 0.2;
    if (Math.abs(tx - g.rotation.x) > 0.002 || Math.abs(ty - g.rotation.y) > 0.002) invalidate();
  });

  return (
    <group ref={group}>
      <sprite material={glow} scale={[5.2, 5.2, 1]} position={[0, 0, -0.6]} />
      <mesh geometry={geometry} material={material} />
    </group>
  );
}

function PointerInvalidate() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const on = () => invalidate();
    window.addEventListener("pointermove", on, { passive: true });
    return () => window.removeEventListener("pointermove", on);
  }, [invalidate]);
  return null;
}

export default function TimerRing3D({
  progress,
  tone,
  className,
}: {
  progress: number;
  tone: "gold" | "success" | "destructive";
  className?: string;
}) {
  return (
    <CanvasShell className={className} frameloop="demand" camera={{ position: [0, 0, 5.4], fov: 45 }}>
      <PointerInvalidate />
      <Ring progress={progress} tone={tone} />
    </CanvasShell>
  );
}
