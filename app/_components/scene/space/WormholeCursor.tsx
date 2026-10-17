"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  advectionFragment,
  baseVertex,
  clearFragment,
  compositeFragment,
  curlFragment,
  divergenceFragment,
  gradientSubtractFragment,
  pressureFragment,
  splatFragment,
  vorticityFragment,
} from "./fluidShaders";
import { galaxy } from "./galaxyState";

// Simulation settings. Lower resolution is cheaper and looks smoother.
const SIM_RES = 128;
const PRESSURE_ITERATIONS = 18;
const CURL = 22; // how strongly the flow curls into swirls
const VELOCITY_DISSIPATION = 1.8; // higher fades the trail faster
const SPLAT_FORCE = 3000;
const SPLAT_RADIUS = 0.0022;

type DoubleTarget = { read: THREE.WebGLRenderTarget; write: THREE.WebGLRenderTarget; swap: () => void };

function makeTarget(w: number, h: number) {
  return new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
  });
}

function makeDouble(w: number, h: number): DoubleTarget {
  const d = { read: makeTarget(w, h), write: makeTarget(w, h), swap: () => {} };
  d.swap = () => {
    const t = d.read;
    d.read = d.write;
    d.write = t;
  };
  return d;
}

// Live pointer state, written by DOM events and read every frame.
const pointer = { x: 0.5, y: 0.5, dx: 0, dy: 0, moved: false, inside: false, lastMove: 0, speed: 0 };

function createSim(width: number, height: number) {
    const aspect = width / Math.max(height, 1);
    const w = Math.round(SIM_RES * Math.max(aspect, 1));
    const h = Math.round(SIM_RES / Math.min(aspect, 1));
    const texel = new THREE.Vector2(1 / w, 1 / h);

    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    quad.frustumCulled = false;
    const quadScene = new THREE.Scene();
    quadScene.add(quad);

    const mat = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({
        vertexShader: baseVertex,
        fragmentShader,
        uniforms: { texelSize: { value: texel }, ...uniforms },
        depthTest: false,
        depthWrite: false,
      });

    return {
      w,
      h,
      texel,
      quad,
      quadScene,
      quadCam,
      velocity: makeDouble(w, h),
      pressure: makeDouble(w, h),
      divergence: makeTarget(w, h),
      curl: makeTarget(w, h),
      sceneTarget: new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true }),
      splat: mat(splatFragment, {
        uTarget: { value: null },
        aspectRatio: { value: aspect },
        color: { value: new THREE.Vector3() },
        point: { value: new THREE.Vector2() },
        radius: { value: SPLAT_RADIUS },
      }),
      curlMat: mat(curlFragment, { uVelocity: { value: null } }),
      vorticity: mat(vorticityFragment, {
        uVelocity: { value: null },
        uCurl: { value: null },
        curl: { value: CURL },
        dt: { value: 0.016 },
      }),
      divergenceMat: mat(divergenceFragment, { uVelocity: { value: null } }),
      clear: mat(clearFragment, { uTexture: { value: null }, value: { value: 0.8 } }),
      pressureMat: mat(pressureFragment, { uPressure: { value: null }, uDivergence: { value: null } }),
      gradient: mat(gradientSubtractFragment, { uPressure: { value: null }, uVelocity: { value: null } }),
      advection: mat(advectionFragment, {
        uVelocity: { value: null },
        uSource: { value: null },
        dt: { value: 0.016 },
        dissipation: { value: VELOCITY_DISSIPATION },
      }),
      composite: new THREE.ShaderMaterial({
        vertexShader: baseVertex,
        fragmentShader: compositeFragment,
        uniforms: {
          texelSize: { value: texel },
          tScene: { value: null },
          tFluid: { value: null },
          uMouse: { value: new THREE.Vector2(0.5, 0.5) },
          uAspect: { value: aspect },
          uRadius: { value: 0.07 },
          uOpen: { value: 0 },
          uTime: { value: 0 },
          uSpin: { value: 0 },
        },
        depthTest: false,
        depthWrite: false,
      }),
    };
}

type Sim = ReturnType<typeof createSim>;

/**
 * The cursor: a wormhole that follows the mouse, riding on a fluid simulation.
 * This component takes over the final render: the galaxy is drawn into a
 * texture, the fluid is stepped, and a full-screen pass shows the galaxy
 * carried through the flow with the wormhole on top.
 */
export default function WormholeCursor() {
  const { gl, size, scene, camera } = useThree();

  // Simulation buffers live in a ref: they are GPU objects updated every frame.
  const simRef = useRef<Sim | null>(null);


  // Build the simulation for this window size (and rebuild when it changes).
  useEffect(() => {
    const sim = createSim(size.width, size.height);
    const dpr = gl.getPixelRatio();
    sim.sceneTarget.setSize(Math.floor(size.width * dpr), Math.floor(size.height * dpr));
    simRef.current = sim;
    return () => {
      simRef.current = null;
      [sim.velocity.read, sim.velocity.write, sim.pressure.read, sim.pressure.write, sim.divergence, sim.curl, sim.sceneTarget].forEach((t) =>
        t.dispose()
      );
      [sim.splat, sim.curlMat, sim.vorticity, sim.divergenceMat, sim.clear, sim.pressureMat, sim.gradient, sim.advection, sim.composite].forEach((m) =>
        m.dispose()
      );
    };
  }, [gl, size.width, size.height]);

  // Track the mouse anywhere on the page.
  useEffect(() => {
    let lastX = -1;
    let lastY = -1;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const x = e.clientX / window.innerWidth;
      const y = 1 - e.clientY / window.innerHeight;
      if (lastX >= 0) {
        pointer.dx += x - lastX;
        pointer.dy += y - lastY;
        pointer.moved = true;
      }
      lastX = x;
      lastY = y;
      pointer.x = x;
      pointer.y = y;
      pointer.inside = true;
      pointer.lastMove = performance.now();
    };
    const leave = () => {
      pointer.inside = false;
      lastX = -1;
    };
    window.addEventListener("pointermove", move);
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, []);

  // Priority 1 means this frame callback does the rendering itself.
  useFrame((state, delta) => {
    const sim = simRef.current;
    if (!sim) {
      // Not built yet: draw the galaxy normally for this frame.
      gl.setRenderTarget(null);
      gl.render(scene, camera);
      return;
    }
    const dt = Math.min(delta, 1 / 30);
    const { quadScene, quadCam } = sim;
    const quad = quadScene.children[0] as THREE.Mesh;
    const pass = (material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
      quad.material = material;
      gl.setRenderTarget(target);
      gl.render(quadScene, quadCam);
    };
    const u = (m: THREE.ShaderMaterial) => m.uniforms;

    // 1. Draw the galaxy into a texture.
    gl.setRenderTarget(sim.sceneTarget);
    gl.clear();
    gl.render(scene, camera);

    // 2. Push velocity into the fluid where the mouse moved.
    if (pointer.moved) {
      u(sim.splat).uTarget.value = sim.velocity.read.texture;
      u(sim.splat).point.value.set(pointer.x, pointer.y);
      u(sim.splat).color.value.set(pointer.dx * SPLAT_FORCE, pointer.dy * SPLAT_FORCE, 0);
      pass(sim.splat, sim.velocity.write);
      sim.velocity.swap();
      pointer.speed = Math.hypot(pointer.dx, pointer.dy) / Math.max(dt, 1e-3);
      pointer.moved = false;
      pointer.dx = 0;
      pointer.dy = 0;
    } else {
      pointer.speed *= Math.exp(-6 * dt);
    }

    // 3. Step the fluid: swirl, then make it incompressible, then advect.
    u(sim.curlMat).uVelocity.value = sim.velocity.read.texture;
    pass(sim.curlMat, sim.curl);

    u(sim.vorticity).uVelocity.value = sim.velocity.read.texture;
    u(sim.vorticity).uCurl.value = sim.curl.texture;
    u(sim.vorticity).dt.value = dt;
    pass(sim.vorticity, sim.velocity.write);
    sim.velocity.swap();

    u(sim.divergenceMat).uVelocity.value = sim.velocity.read.texture;
    pass(sim.divergenceMat, sim.divergence);

    u(sim.clear).uTexture.value = sim.pressure.read.texture;
    pass(sim.clear, sim.pressure.write);
    sim.pressure.swap();

    u(sim.pressureMat).uDivergence.value = sim.divergence.texture;
    for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
      u(sim.pressureMat).uPressure.value = sim.pressure.read.texture;
      pass(sim.pressureMat, sim.pressure.write);
      sim.pressure.swap();
    }

    u(sim.gradient).uPressure.value = sim.pressure.read.texture;
    u(sim.gradient).uVelocity.value = sim.velocity.read.texture;
    pass(sim.gradient, sim.velocity.write);
    sim.velocity.swap();

    u(sim.advection).uVelocity.value = sim.velocity.read.texture;
    u(sim.advection).uSource.value = sim.velocity.read.texture;
    u(sim.advection).dt.value = dt;
    pass(sim.advection, sim.velocity.write);
    sim.velocity.swap();

    // 4. Composite to the screen with the wormhole at the cursor.
    const c = u(sim.composite);
    c.tScene.value = sim.sceneTarget.texture;
    c.tFluid.value = sim.velocity.read.texture;
    c.uMouse.value.lerp(new THREE.Vector2(pointer.x, pointer.y), 1 - Math.exp(-18 * dt));
    c.uTime.value += dt;

    // The mouth opens while the mouse is on the page, grows with speed and
    // over planets, and closes while a project panel is open.
    const idle = performance.now() - pointer.lastMove > 2600;
    const wantOpen = pointer.inside && !idle && galaxy.focused < 0 ? 1 : 0;
    c.uOpen.value += (wantOpen - c.uOpen.value) * (1 - Math.exp(-(wantOpen ? 6 : 2.5) * dt));
    const base = 0.055 + (galaxy.hovered >= 0 ? 0.03 : 0);
    const targetRadius = base + Math.min(pointer.speed * 0.012, 0.05);
    c.uRadius.value += (targetRadius - c.uRadius.value) * (1 - Math.exp(-8 * dt));
    const spinTarget = THREE.MathUtils.clamp(pointer.speed * 0.4, 0, 2.5);
    c.uSpin.value += (spinTarget - c.uSpin.value) * (1 - Math.exp(-4 * dt));
    pass(sim.composite, null);

    state.gl.setRenderTarget(null);
  }, 1);

  return null;
}
