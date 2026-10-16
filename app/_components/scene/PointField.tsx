"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { pointFieldFragment, pointFieldVertex } from "./shaders";
import { sceneState } from "./store";

type Props = { cols: number; rows: number; spacing: number };

export default function PointField({ cols, rows, spacing }: Props) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const { gl } = useThree();
  const pointer = useMemo(() => new THREE.Vector2(99, 99), []);
  const target = useMemo(() => new THREE.Vector2(99, 99), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const hit = useMemo(() => new THREE.Vector3(), []);

  const geometry = useMemo(() => {
    const count = cols * rows;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    let i = 0;
    for (let x = 0; x < cols; x++) {
      for (let z = 0; z < rows; z++) {
        positions[i * 3] = (x - cols / 2) * spacing;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = (z - rows / 2) * spacing;
        // Deterministic pseudo-random seed per point (keeps renders pure).
        const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
        seeds[i] = h - Math.floor(h);
        i++;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    return g;
  }, [cols, rows, spacing]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uSize: { value: 22 },
      uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
      uPointer: { value: pointer },
      uInk: { value: new THREE.Color("#0e1a2b") },
      uSignal: { value: new THREE.Color("#2549d8") },
    }),
    [gl, pointer]
  );

  useFrame((state, delta) => {
    if (!material.current) return;
    const u = material.current.uniforms;
    u.uTime.value += delta;
    u.uScroll.value = sceneState.scroll;

    // Project the cursor onto the field's plane so the lift follows it.
    state.raycaster.setFromCamera(state.pointer, state.camera);
    if (state.raycaster.ray.intersectPlane(plane, hit)) target.set(hit.x, hit.z);
    pointer.lerp(target, 0.08);
  });

  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={material}
        vertexShader={pointFieldVertex}
        fragmentShader={pointFieldFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </points>
  );
}
