"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import * as THREE from "three";
import { cursorFragment, cursorVertex } from "./scene/shaders";

// Live cursor state, written by DOM listeners and read every frame.
const cursor = { vx: 0, vy: 0, hover: 0, lastMove: 0 };

const SIZE = 360; // canvas size in CSS pixels
const RADIUS = 56; // radius of the grain disc in px
const SPACING = 3.2; // distance between dots in px, smaller means denser

function GrainDisc() {
  const material = useRef<THREE.ShaderMaterial>(null);
  const { gl } = useThree();

  // An even grid of dots clipped to a circle, so the texture is uniform.
  const geometry = useMemo(() => {
    const pts: number[] = [];
    for (let x = -RADIUS; x <= RADIUS; x += SPACING) {
      for (let y = -RADIUS; y <= RADIUS; y += SPACING) {
        if (Math.hypot(x, y) <= RADIUS) pts.push(x, y, 0);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  const uniforms = useMemo(
    () => ({
      uVel: { value: new THREE.Vector2() },
      uHover: { value: 0 },
      uVisible: { value: 0 },
      uSize: { value: 1.6 },
      uRadius: { value: RADIUS },
      uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
    }),
    [gl]
  );

  useFrame((_, delta) => {
    const u = material.current?.uniforms;
    if (!u) return;
    // Frame-rate independent easing.
    const ease = (rate: number) => 1 - Math.exp(-rate * delta);

    // Treat the mouse as stopped once no movement has arrived for a moment.
    const moving = performance.now() - cursor.lastMove < 70;
    const vx = moving ? cursor.vx : 0;
    const vy = moving ? cursor.vy : 0;
    u.uVel.value.x += (vx - u.uVel.value.x) * ease(12);
    u.uVel.value.y += (vy - u.uVel.value.y) * ease(12);
    u.uHover.value += (cursor.hover - u.uHover.value) * ease(8);

    // Visible only while the mouse moves; fades out quickly once it stops.
    const target = moving ? 1 : 0;
    u.uVisible.value += (target - u.uVisible.value) * ease(target > u.uVisible.value ? 18 : 6);
  });

  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={material}
        vertexShader={cursorVertex}
        fragmentShader={cursorFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </points>
  );
}

export default function GrainCursor() {
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;

    const xTo = gsap.quickTo(el, "x", { duration: 0.12, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.12, ease: "power3.out" });
    let lastX = -1;
    let lastY = -1;

    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (lastX < 0) {
        gsap.set(el, { x: e.clientX - SIZE / 2, y: e.clientY - SIZE / 2 });
      } else {
        // Screen y points down, the shader's y points up.
        cursor.vx = gsap.utils.clamp(-60, 60, e.clientX - lastX);
        cursor.vy = gsap.utils.clamp(-60, 60, -(e.clientY - lastY));
      }
      lastX = e.clientX;
      lastY = e.clientY;
      cursor.lastMove = performance.now();
      xTo(e.clientX - SIZE / 2);
      yTo(e.clientY - SIZE / 2);
    };
    const over = (e: PointerEvent) => {
      const t = e.target as Element | null;
      cursor.hover = t?.closest("a, button") ? 1 : 0;
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerover", over);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerover", over);
    };
  }, []);

  return (
    <div
      ref={wrap}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[100] mix-blend-difference"
      style={{ width: SIZE, height: SIZE }}
    >
      <Canvas
        orthographic
        camera={{ position: [0, 0, 10], zoom: 1 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        fallback={null}
      >
        <GrainDisc />
      </Canvas>
    </div>
  );
}
