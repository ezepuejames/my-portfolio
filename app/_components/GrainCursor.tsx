"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import * as THREE from "three";
import { cursorFragment, cursorVertex } from "./scene/shaders";

// Live cursor state, written by DOM listeners and read every frame.
const cursor = { vx: 0, vy: 0, hover: 0, down: 0 };

const SIZE = 180; // canvas size in CSS pixels

function GrainDisc() {
  const material = useRef<THREE.ShaderMaterial>(null);
  const { gl } = useThree();

  const geometry = useMemo(() => {
    const spacing = 3.8;
    const radius = 20;
    const pts: number[] = [];
    const seeds: number[] = [];
    for (let x = -radius; x <= radius; x += spacing) {
      for (let y = -radius; y <= radius; y += spacing) {
        if (Math.hypot(x, y) > radius) continue;
        pts.push(x, y, 0);
        const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        seeds.push(h - Math.floor(h));
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute("aSeed", new THREE.Float32BufferAttribute(seeds, 1));
    return g;
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uVel: { value: new THREE.Vector2() },
      uHover: { value: 0 },
      uDown: { value: 0 },
      uSize: { value: 3.4 },
      uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
    }),
    [gl]
  );

  useFrame((_, delta) => {
    const u = material.current?.uniforms;
    if (!u) return;
    u.uTime.value += delta;
    // Ease uniforms toward the live cursor state for a soft, trailing feel.
    u.uVel.value.x += (cursor.vx - u.uVel.value.x) * 0.15;
    u.uVel.value.y += (cursor.vy - u.uVel.value.y) * 0.15;
    u.uHover.value += (cursor.hover - u.uHover.value) * 0.12;
    u.uDown.value += (cursor.down - u.uDown.value) * 0.25;
    cursor.vx *= 0.88;
    cursor.vy *= 0.88;
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

    const html = document.documentElement;
    html.classList.add("has-grain-cursor");

    const xTo = gsap.quickTo(el, "x", { duration: 0.35, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.35, ease: "power3.out" });
    let lastX = -1;
    let lastY = -1;

    const move = (e: PointerEvent) => {
      if (lastX < 0) {
        gsap.set(el, { x: e.clientX - SIZE / 2, y: e.clientY - SIZE / 2, opacity: 1 });
      } else {
        // Screen y points down, the shader's y points up.
        cursor.vx = gsap.utils.clamp(-40, 40, e.clientX - lastX);
        cursor.vy = gsap.utils.clamp(-40, 40, -(e.clientY - lastY));
      }
      lastX = e.clientX;
      lastY = e.clientY;
      xTo(e.clientX - SIZE / 2);
      yTo(e.clientY - SIZE / 2);
    };
    const over = (e: PointerEvent) => {
      const t = e.target as Element | null;
      cursor.hover = t?.closest("a, button") ? 1 : 0;
    };
    const down = () => (cursor.down = 1);
    const up = () => (cursor.down = 0);
    const leave = () => gsap.to(el, { opacity: 0, duration: 0.2 });
    const enter = () => gsap.to(el, { opacity: 1, duration: 0.2 });

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerover", over);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    document.addEventListener("pointerleave", leave);
    document.addEventListener("pointerenter", enter);

    return () => {
      html.classList.remove("has-grain-cursor");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerover", over);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      document.removeEventListener("pointerleave", leave);
      document.removeEventListener("pointerenter", enter);
    };
  }, []);

  return (
    <div
      ref={wrap}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[100] opacity-0 mix-blend-difference"
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
