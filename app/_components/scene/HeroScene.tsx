"use client";

import { useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import PointField from "./PointField";
import ModelSlot from "./ModelSlot";
import { sceneState } from "./store";
import { models } from "../../content";

function CameraRig({ narrow }: { narrow: boolean }) {
  useFrame((state) => {
    const s = sceneState.scroll;
    const intro = sceneState.intro;
    const cam = state.camera;
    // Settle in from further away during the intro, then rise as the hero scrolls away.
    const z = (narrow ? 9 : 7) + (1 - intro) * 3;
    cam.position.set(state.pointer.x * 0.3, 2.2 + s * 2.4, z - s * 1.5);
    cam.lookAt(0, (narrow ? 2.7 : 2.6) + s * 1.2, 0);
  });
  return null;
}

export default function HeroScene({ reducedMotion }: { reducedMotion: boolean }) {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 2.6, 10], fov: 40 }}
      frameloop={reducedMotion ? "demand" : "always"}
      gl={{ antialias: true, alpha: true }}
      fallback={null}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} />
      <CameraRig narrow={narrow} />
      <PointField cols={narrow ? 80 : 150} rows={narrow ? 70 : 90} spacing={narrow ? 0.15 : 0.12} />
      {/* MODEL SLOT: hero. Set models.hero in app/content.ts to load a .glb here. */}
      <ModelSlot url={models.hero} scale={narrow ? 0.45 : 0.75} position={narrow ? [0.45, 0.8, 1.5] : [2.9, 1.9, 0]} />
    </Canvas>
  );
}
