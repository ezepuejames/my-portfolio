"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FluidSim } from "./fluid/FluidSim";

/**
 * The cursor. Takes over rendering of the galaxy: the scene is drawn into a
 * texture, a fluid simulation stirred by the mouse bends it, and a wormhole
 * opens at the cursor while you move. Your normal pointer stays visible.
 */
export default function WormholeCursor() {
  const { gl, size } = useThree();
  const sim = useMemo(() => new FluidSim(1, 1), []);
  const pointer = useRef({ x: 0.5, y: 0.5, px: 0.5, py: 0.5, moved: false, lastMove: -10, inside: false });
  const radius = useRef(0);
  const mouse = useMemo(() => new THREE.Vector2(0.5, 0.5), []);
  const drawSize = useMemo(() => new THREE.Vector2(), []);

  useEffect(() => {
    gl.getDrawingBufferSize(drawSize);
    sim.resize(drawSize.x, drawSize.y);
  }, [gl, size, sim, drawSize]);

  useEffect(() => () => sim.dispose(), [sim]);

  useEffect(() => {
    const canvas = gl.domElement;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const rect = canvas.getBoundingClientRect();
      const p = pointer.current;
      p.x = (e.clientX - rect.left) / rect.width;
      p.y = 1 - (e.clientY - rect.top) / rect.height;
      p.inside = p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
      p.moved = true;
      p.lastMove = performance.now();
    };
    const leave = () => (pointer.current.inside = false);
    window.addEventListener("pointermove", move);
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, [gl]);

  // Priority 1: run after every other frame update, and do the rendering ourselves.
  useFrame((state, delta) => {
    const aspect = state.size.width / state.size.height;
    const p = pointer.current;
    const dt = Math.min(delta, 1 / 30);

    if (p.moved) {
      const dx = p.x - p.px;
      const dy = p.y - p.py;
      if (Math.abs(dx) + Math.abs(dy) < 0.25) sim.splat(gl, p.x, p.y, dx, dy, aspect);
      p.px = p.x;
      p.py = p.y;
      p.moved = false;
    }
    sim.step(gl, dt);

    // The wormhole grows while you move and closes a moment after you stop.
    const idle = (performance.now() - p.lastMove) / 1000;
    const target = p.inside && idle < 1.6 ? 0.09 : 0;
    radius.current += (target - radius.current) * (1 - Math.exp(-(target > radius.current ? 6 : 3) * delta));
    mouse.lerp(new THREE.Vector2(p.x, p.y), 1 - Math.exp(-14 * delta));

    // Draw the galaxy into a texture, then to the screen through the effect.
    gl.setRenderTarget(sim.sceneTarget);
    gl.clear();
    gl.render(state.scene, state.camera);
    sim.composite(gl, mouse, aspect, radius.current, state.clock.elapsedTime);
    gl.setRenderTarget(null);
  }, 1);

  return null;
}
