"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { CanvasShell } from "@/components/three/canvas-shell";

const vertexShader = `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSeed;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float t = uTime * 0.07 + aSeed * 13.0;
    float life = fract(t);
    p.y = mix(-3.4, 3.4, life);
    p.x += sin(t * 6.2831 + aSeed * 21.0) * 0.45 + sin(uTime * 0.3 + aSeed * 5.0) * 0.12;
    vAlpha = smoothstep(0.0, 0.25, life) * (1.0 - smoothstep(0.55, 1.0, life));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (260.0 + aSeed * 420.0) * uPixelRatio / -mv.z;
  }
`;

const fragmentShader = `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColor, a * a * a * vAlpha * uOpacity);
  }
`;

function SteamPoints({
  count,
  color,
  opacity,
  additive,
}: {
  count: number;
  color: string;
  opacity: number;
  additive: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 9;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 3;
      seeds[i] = Math.random();
    }
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    return g;
  }, [count]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: Math.min(window.devicePixelRatio, 1.5) },
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: opacity },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      }),
    [color, opacity, additive],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state, delta) => {
    material.uniforms.uTime.value += Math.min(delta, 0.05);
    const g = group.current;
    if (!g) return;
    g.rotation.y += (state.pointer.x * 0.18 - g.rotation.y) * 0.04;
    g.rotation.x += (-state.pointer.y * 0.08 - g.rotation.x) * 0.04;
  });

  return (
    <group ref={group}>
      <points geometry={geometry} material={material} />
    </group>
  );
}

export default function Steam({
  className,
  color = "#ffffff",
  opacity = 0.35,
  additive = true,
  count = 90,
}: {
  className?: string;
  color?: string;
  opacity?: number;
  additive?: boolean;
  count?: number;
}) {
  return (
    <CanvasShell className={className}>
      <SteamPoints count={count} color={color} opacity={opacity} additive={additive} />
    </CanvasShell>
  );
}
