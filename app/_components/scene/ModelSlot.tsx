"use client";

import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Center, Float, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { placeholderFragment, placeholderVertex } from "./shaders";

type Props = {
  /** Path to a .glb/.gltf in /public, e.g. "/models/hero.glb". Null shows the placeholder. */
  url: string | null;
  scale?: number;
  position?: [number, number, number];
  /** Use light placeholder colours when the slot sits on a dark background. */
  onDark?: boolean;
};

function Model({ url, scale = 1 }: { url: string; scale?: number }) {
  const { scene } = useGLTF(url);
  return (
    <Center>
      <primitive object={scene} scale={scale} />
    </Center>
  );
}

function Placeholder({ scale = 1, onDark = false }: { scale?: number; onDark?: boolean }) {
  const shell = useRef<THREE.ShaderMaterial>(null);
  const group = useRef<THREE.Group>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uInk: { value: new THREE.Color(onDark ? "#f5f7fa" : "#0e1a2b") },
      uSignal: { value: new THREE.Color(onDark ? "#8aa4ff" : "#2549d8") },
    }),
    [onDark]
  );

  useFrame((_, delta) => {
    if (shell.current) shell.current.uniforms.uTime.value += delta;
    if (group.current) group.current.rotation.y += delta * 0.25;
  });

  return (
    <group ref={group} scale={scale}>
      <mesh>
        <icosahedronGeometry args={[1, 3]} />
        <shaderMaterial
          ref={shell}
          vertexShader={placeholderVertex}
          fragmentShader={placeholderFragment}
          uniforms={uniforms}
          transparent
          depthWrite={false}
        />
      </mesh>
      <mesh scale={1.004}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={onDark ? "#f5f7fa" : "#0e1a2b"} wireframe transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

export default function ModelSlot({ url, scale = 1, position = [0, 0, 0], onDark = false }: Props) {
  return (
    <group position={position}>
      <Float speed={1.4} rotationIntensity={0.3} floatIntensity={0.6}>
        {url ? (
          <Suspense fallback={<Placeholder scale={scale} onDark={onDark} />}>
            <Model url={url} scale={scale} />
          </Suspense>
        ) : (
          <Placeholder scale={scale} onDark={onDark} />
        )}
      </Float>
    </group>
  );
}
