"use client";

// Desktop-full only: the dish photo on a slowly turning 3D plate. A ceramic
// plate (lathe) + a slightly domed disc wearing the photo; 2 lights, ~8k
// triangles, one ~1080px texture (WebP/AVIF via the Next image optimizer),
// disposed on unmount. It fades in over the static photo once ready, so it
// never affects LCP.

import { useFrame } from "@react-three/fiber";
import { getImageProps } from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { CanvasShell } from "@/components/three/canvas-shell";
import { dishPhotoUrl } from "@/lib/photos";

function usePhotoTexture(photoPath: string) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    const src = getImageProps({ src: dishPhotoUrl(photoPath)!, alt: "", width: 1080, height: 1080, quality: 75 }).props
      .src;
    let cancelled = false;
    let loaded: THREE.Texture | null = null;
    new THREE.TextureLoader().load(src, (t) => {
      if (cancelled) return t.dispose();
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      // Cover-crop the photo into the circle.
      const img = t.image as { width: number; height: number };
      const aspect = img.width / img.height;
      if (aspect > 1) {
        t.repeat.set(1 / aspect, 1);
        t.offset.set((1 - 1 / aspect) / 2, 0);
      } else {
        t.repeat.set(1, aspect);
        t.offset.set(0, (1 - aspect) / 2);
      }
      loaded = t;
      setTexture(t);
    });
    return () => {
      cancelled = true;
      loaded?.dispose();
    };
  }, [photoPath]);
  return texture;
}

function Plate({ photoPath }: { photoPath: string }) {
  const texture = usePhotoTexture(photoPath);
  const group = useRef<THREE.Group>(null);

  const plateGeometry = useMemo(() => {
    // Rim profile: flat base, curved lip.
    const pts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(1.55, 0),
      new THREE.Vector2(1.95, 0.12),
      new THREE.Vector2(2.18, 0.3),
      new THREE.Vector2(2.24, 0.34),
      new THREE.Vector2(2.2, 0.36),
      new THREE.Vector2(1.9, 0.2),
      new THREE.Vector2(1.5, 0.08),
      new THREE.Vector2(0, 0.06),
    ];
    return new THREE.LatheGeometry(pts, 96);
  }, []);

  const foodGeometry = useMemo(() => {
    // A gentle dome so the food catches the light ("slight displacement").
    const g = new THREE.CircleGeometry(1.5, 96, 0, Math.PI * 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const r = Math.min(1, Math.hypot(x, y) / 1.5);
      pos.setZ(i, 0.16 * (1 - r * r));
    }
    g.computeVertexNormals();
    return g;
  }, []);

  const plateMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#fbf8f4", roughness: 0.35, metalness: 0 }),
    [],
  );
  const foodMaterial = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0 }), []);

  useEffect(() => {
    foodMaterial.map = texture;
    foodMaterial.needsUpdate = true;
  }, [texture, foodMaterial]);

  useEffect(
    () => () => {
      plateGeometry.dispose();
      foodGeometry.dispose();
      plateMaterial.dispose();
      foodMaterial.dispose();
    },
    [plateGeometry, foodGeometry, plateMaterial, foodMaterial],
  );

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    g.rotation.y += Math.min(delta, 0.05) * 0.22;
    // Tilted toward the camera (we look at the food from above), cursor parallax.
    g.rotation.x += (0.85 - state.pointer.y * 0.15 - g.rotation.x) * 0.05;
    g.position.x += (state.pointer.x * 0.25 - g.position.x) * 0.05;
  });

  return (
    <group ref={group} rotation={[0.85, 0, 0]} position={[0, -0.15, 0]}>
      <mesh geometry={plateGeometry} material={plateMaterial} />
      {texture ? (
        <mesh geometry={foodGeometry} material={foodMaterial} position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      ) : null}
    </group>
  );
}

export function DishPlate3D({ photoPath, name }: { photoPath: string; name: string }) {
  return (
    <CanvasShell
      className="absolute inset-0 bg-gradient-to-b from-muted to-card"
      camera={{ position: [0, 0, 7.4], fov: 40 }}
      label={name}
    >
      <ambientLight intensity={1.1} />
      <directionalLight position={[3, 5, 4]} intensity={2.2} />
      <Plate photoPath={photoPath} />
    </CanvasShell>
  );
}
