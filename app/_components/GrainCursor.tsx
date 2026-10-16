"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import * as THREE from "three";
import { cursorFragment, cursorVertex } from "./scene/shaders";

// Live cursor state, written by DOM listeners and read every frame.
const cursor = { vx: 0, vy: 0, hover: 0 };

const LENS = 150; // lens diameter in CSS pixels
const DOTS = 900; // number of grain dots inside the lens
const PULL = 46; // strength of the gravitational warp, in pixels
const IDLE_MS = 2200; // hide the lens after this long without movement

/**
 * Builds the displacement map for the gravity lens. Red and green encode how
 * far each pixel samples from: content is pulled in toward the centre, which
 * bends and wraps whatever sits under the cursor. It eases to zero at the rim
 * so there is no hard seam.
 */
function buildLensMap(size: number) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const r0 = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5 - r0) / r0;
      const v = (y + 0.5 - r0) / r0;
      const r = Math.hypot(u, v);
      let dx = 0;
      let dy = 0;
      if (r > 0 && r < 1) {
        const amt = r * (1 - r * r) * 2.6; // peaks around 0.58 of the radius
        dx = (u / r) * amt;
        dy = (v / r) * amt;
      }
      const i = (y * size + x) * 4;
      img.data[i] = Math.round(gsap.utils.clamp(0, 255, 128 + dx * 127));
      img.data[i + 1] = Math.round(gsap.utils.clamp(0, 255, 128 + dy * 127));
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

function GrainDisc() {
  const material = useRef<THREE.ShaderMaterial>(null);
  const { gl } = useThree();

  // Stippled grain: dots scattered evenly over the disc at random positions.
  const geometry = useMemo(() => {
    const pts = new Float32Array(DOTS * 3);
    const seeds = new Float32Array(DOTS);
    const radius = LENS / 2 - 6;
    for (let i = 0; i < DOTS; i++) {
      const h1 = Math.sin(i * 12.9898) * 43758.5453;
      const h2 = Math.sin(i * 78.233 + 1.7) * 24634.6345;
      const a = (h1 - Math.floor(h1)) * Math.PI * 2;
      const r = Math.sqrt(h2 - Math.floor(h2)) * radius; // sqrt keeps density even
      pts[i * 3] = Math.cos(a) * r;
      pts[i * 3 + 1] = Math.sin(a) * r;
      seeds[i] = h2 - Math.floor(h2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    return g;
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uVel: { value: new THREE.Vector2() },
      uHover: { value: 0 },
      uSize: { value: 1.8 },
      uRadius: { value: LENS / 2 - 6 },
      uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
    }),
    [gl]
  );

  useFrame((_, delta) => {
    const u = material.current?.uniforms;
    if (!u) return;
    const ease = (rate: number) => 1 - Math.exp(-rate * delta);
    u.uTime.value += delta;
    u.uVel.value.x += (cursor.vx - u.uVel.value.x) * ease(10);
    u.uVel.value.y += (cursor.vy - u.uVel.value.y) * ease(10);
    u.uHover.value += (cursor.hover - u.uHover.value) * ease(8);
    cursor.vx *= Math.exp(-8 * delta);
    cursor.vy *= Math.exp(-8 * delta);
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
  const lens = useRef<HTMLDivElement>(null);
  const grain = useRef<HTMLDivElement>(null);
  const feImage = useRef<SVGFEImageElement>(null);

  useEffect(() => {
    const lensEl = lens.current;
    const grainEl = grain.current;
    if (!lensEl || !grainEl) return;

    // Chromium can run an SVG displacement filter as a backdrop filter, which
    // is what warps the page. Other browsers get the colour inversion only.
    const ua = navigator.userAgent;
    const chromium = /Chrome|Chromium|Edg\//.test(ua) && !/Firefox/.test(ua);
    if (chromium) {
      feImage.current?.setAttribute("href", buildLensMap(LENS));
      lensEl.style.setProperty("backdrop-filter", "url(#gravity-lens) invert(1)");
    }

    const els = [lensEl, grainEl];
    const xTo = els.map((el) => gsap.quickTo(el, "x", { duration: 0.28, ease: "power3.out" }));
    const yTo = els.map((el) => gsap.quickTo(el, "y", { duration: 0.28, ease: "power3.out" }));
    let lastX = -1;
    let lastY = -1;
    let idle: ReturnType<typeof setTimeout> | undefined;
    let shown = false;

    const show = () => {
      if (shown) return;
      shown = true;
      gsap.to(els, { opacity: 1, scale: 1, duration: 0.35, ease: "power3.out", overwrite: "auto" });
    };
    const hide = () => {
      shown = false;
      gsap.to(els, { opacity: 0, scale: 0.6, duration: 0.5, ease: "power2.in", overwrite: "auto" });
    };

    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const x = e.clientX - LENS / 2;
      const y = e.clientY - LENS / 2;
      if (lastX < 0) {
        gsap.set(els, { x, y });
      } else {
        // Screen y points down, the shader's y points up.
        cursor.vx = gsap.utils.clamp(-50, 50, e.clientX - lastX);
        cursor.vy = gsap.utils.clamp(-50, 50, -(e.clientY - lastY));
      }
      lastX = e.clientX;
      lastY = e.clientY;
      xTo.forEach((f) => f(x));
      yTo.forEach((f) => f(y));
      show();
      clearTimeout(idle);
      idle = setTimeout(hide, IDLE_MS);
    };
    const over = (e: PointerEvent) => {
      const t = e.target as Element | null;
      cursor.hover = t?.closest("a, button") ? 1 : 0;
      gsap.to(lensEl, { "--lens-scale": cursor.hover ? 1.25 : 1, duration: 0.4, ease: "power3.out" });
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerover", over);
    document.documentElement.addEventListener("pointerleave", hide);
    return () => {
      clearTimeout(idle);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerover", over);
      document.documentElement.removeEventListener("pointerleave", hide);
    };
  }, []);

  return (
    <>
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <filter id="gravity-lens" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feImage ref={feImage} x="0" y="0" width={LENS} height={LENS} result="map" preserveAspectRatio="none" />
          <feDisplacementMap in="SourceGraphic" in2="map" scale={PULL} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      {/* The lens: inverts and (in Chromium) warps whatever is underneath. */}
      <div
        ref={lens}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[99] rounded-full opacity-0"
        style={{
          width: LENS,
          height: LENS,
          backdropFilter: "invert(1)",
          WebkitBackdropFilter: "invert(1)",
          scale: "var(--lens-scale, 1)",
        }}
      />

      {/* The grain: stippled dots drawn with a GLSL shader on top of the lens. */}
      <div
        ref={grain}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[100] opacity-0 mix-blend-difference"
        style={{ width: LENS, height: LENS }}
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
    </>
  );
}
