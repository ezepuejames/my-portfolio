"use client";

import { Canvas } from "@react-three/fiber";
import ModelSlot from "./ModelSlot";
import { models } from "../../content";

export default function ContactScene({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 4.2], fov: 40 }}
      frameloop={reducedMotion ? "demand" : "always"}
      gl={{ antialias: true, alpha: true }}
      fallback={null}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} />
      {/* MODEL SLOT: contact. Set models.contact in app/content.ts to load a .glb here. */}
      <ModelSlot url={models.contact} scale={1.1} onDark />
    </Canvas>
  );
}
