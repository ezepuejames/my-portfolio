"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { starfieldFragment, starfieldVertex } from "./spaceShaders";
import { galaxy } from "./galaxyState";

export default function Starfield({ count = 2600 }: { count?: number }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const points = useRef<THREE.Points>(null);
  const { gl } = useThree();

  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Deterministic hash so the sky is the same on every load.
      const h = (n: number) => {
        const v = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
        return v - Math.floor(v);
      };
      const u = h(1) * 2 - 1;
      const theta = h(2) * Math.PI * 2;
      const r = 40 + h(3) * 30;
      const s = Math.sqrt(1 - u * u);
      pos[i * 3] = Math.cos(theta) * s * r;
      pos[i * 3 + 1] = u * r;
      pos[i * 3 + 2] = Math.sin(theta) * s * r;
      seed[i] = h(4);
      size[i] = 1 + Math.pow(h(5), 6) * 3.5; // mostly small, a few bright
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    return g;
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
    }),
    [gl]
  );

  useFrame((_, delta) => {
    if (!material.current || !points.current) return;
    material.current.uniforms.uTime.value += delta;
    material.current.uniforms.uOpacity.value = galaxy.intro;
    points.current.rotation.y += delta * 0.004;
  });

  return (
    <points ref={points} geometry={geometry}>
      <shaderMaterial
        ref={material}
        vertexShader={starfieldVertex}
        fragmentShader={starfieldFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </points>
  );
}
