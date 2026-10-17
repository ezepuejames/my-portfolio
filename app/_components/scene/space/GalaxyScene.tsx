"use client";

import { RefObject, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useFrame } from "@react-three/fiber";
import { Billboard, Center, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import Starfield from "./Starfield";
import {
  dustFragment,
  dustVertex,
  glowFragment,
  glowVertex,
  planetFragment,
  planetVertex,
  starFragment,
  starVertex,
  gridFragment,
  gridVertex,
  MASS_SLOTS,
} from "./spaceShaders";
import { galaxy } from "./galaxyState";
import BlackHole from "./BlackHole";
import WormholeCursor from "./WormholeCursor";
import { AsteroidField, SpaceLabel, TextAsteroids, makeRockGeometry } from "./Asteroids";
import { BLACK_HOLE, NEAR, STAR_GM, SYSTEMS, SystemLook, VOLUME, WAVES } from "./systems";
import { work } from "../../../content";

const LO_Z = NEAR - VOLUME.z; // the far end of the volume
const FAR = VOLUME.z - NEAR; // systems fade in from this distance

const wrapCentered = (v: number, size: number) => ((((v + size / 2) % size) + size) % size) - size / 2;
const wrapDepth = (z: number) => LO_Z + ((((z - LO_Z) % VOLUME.z) + VOLUME.z) % VOLUME.z);

/** Spreads the systems through the volume so there is always something ahead. */
function basePositions(count: number) {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const h = (n: number) => {
      const v = Math.sin(i * 73.13 + n * 19.7) * 43758.5453;
      return v - Math.floor(v);
    };
    const x = (h(1) - 0.5) * (VOLUME.x - 8);
    const y = (h(2) - 0.5) * (VOLUME.y - 6);
    const z = LO_Z + ((i + 0.3 + h(3) * 0.4) / count) * VOLUME.z;
    out.push(new THREE.Vector3(x, y, z));
  }
  // Put the AGM platform just ahead and right of centre once the intro finishes.
  out[0].set(3.2, 0.4, -46);
  return out;
}

function PlanetModel({ url, size }: { url: string; size: number }) {
  const { scene } = useGLTF(url);
  const copy = useMemo(() => scene.clone(true), [scene]);
  return (
    <Center>
      <primitive object={copy} scale={size} />
    </Center>
  );
}

/** Uniforms are updated every frame outside React's render, which is intended. */
function setValue(uniform: { value: number }, v: number) {
  uniform.value = v;
}

function makePlanetUniforms(a: string, b: string, seed: number, bands: number) {
  return {
    uColorA: { value: new THREE.Color(a) },
    uColorB: { value: new THREE.Color(b) },
    uStarPos: { value: new THREE.Vector3() },
    uSeed: { value: seed },
    uBands: { value: bands },
    uFade: { value: 1 },
  };
}

function ProjectSystem({
  index,
  look,
  base,
  planetWorld,
  starWorld,
}: {
  index: number;
  look: SystemLook;
  base: THREE.Vector3;
  planetWorld: THREE.Vector3[];
  starWorld: THREE.Vector3[];
}) {
  const anchor = useRef<THREE.Group>(null);
  const pivot = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const moonRefs = useRef<(THREE.Group | null)[]>([]);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const orbitMat = useRef<THREE.LineBasicMaterial>(null);
  const moonOrbitMat = useRef<THREE.LineBasicMaterial>(null);
  const labelMoon = useRef<THREE.Group>(null);
  const label = useRef<HTMLDivElement>(null);
  const project = work[index];
  const moonletGeometry = useMemo(() => makeRockGeometry(index * 1.7 + 0.3, 1), [index]);
  const down = useRef<{ x: number; y: number } | null>(null);
  const url = work[index]?.model ?? null;

  const planetU = useMemo(() => makePlanetUniforms(look.a, look.b, index * 1.618 + 0.4, look.bands), [look, index]);
  const moonU = useMemo(() => makePlanetUniforms("#55575c", "#c9c6bf", index * 3.1 + 2, 3), [index]);
  const starU = useMemo(
    () => ({
      uTime: { value: 0 },
      uHot: { value: new THREE.Color(look.star.hot) },
      uCool: { value: new THREE.Color(look.star.cool) },
      uFade: { value: 1 },
    }),
    [look]
  );
  const glowU = useMemo(
    () => ({ uTime: { value: 0 }, uColor: { value: new THREE.Color(look.star.hot) }, uFade: { value: 1 } }),
    [look]
  );

  // The orbit path, drawn as a faint circle in the orbital plane.
  const orbitLine = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const t = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(t) * look.orbit, 0, Math.sin(t) * look.orbit));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [look]);

  // Circles for the moons' paths around the planet.
  const moonPaths = useMemo(() => {
    const radii = [...Array.from({ length: look.moons }, (_, k) => look.size * (1.9 + k * 0.75)), look.size * 3.1];
    return radii.map((r) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 96; i++) {
        const t = (i / 96) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(t) * r, 0, Math.sin(t) * r));
      }
      return new THREE.BufferGeometry().setFromPoints(pts);
    });
  }, [look]);

  // Kepler's third law: angular speed falls off with orbit radius^1.5.
  const omega = Math.sqrt(STAR_GM / Math.pow(look.orbit, 3));
  const phase = index * 2.39996;
  const moonOrbits = useMemo(
    () => Array.from({ length: look.moons }, (_, k) => look.size * (1.9 + k * 0.75)),
    [look]
  );

  const scratch = useMemo(() => new THREE.Vector3(), []);
  const camPos = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    if (!anchor.current || !pivot.current || !spin.current) return;
    const t = state.clock.elapsedTime;

    // Place the whole system in the wrapping volume.
    anchor.current.position.set(
      wrapCentered(base.x + galaxy.panX, VOLUME.x),
      wrapCentered(base.y + galaxy.panY, VOLUME.y),
      wrapDepth(base.z + galaxy.travel)
    );

    // Planet on its orbit, and spinning on its tilted axis.
    const theta = phase + t * omega;
    pivot.current.position.set(Math.cos(theta) * look.orbit, 0, Math.sin(theta) * look.orbit);
    spin.current.rotation.y += delta * 0.45;

    moonRefs.current.forEach((m, k) => {
      if (!m) return;
      const r = moonOrbits[k];
      const w = Math.sqrt(0.25 / Math.pow(r, 3)) * 1.4;
      const a = k * 2.1 + t * w;
      m.position.set(Math.cos(a) * r, Math.sin(a * 0.5) * r * 0.08, Math.sin(a) * r);
    });

    // Fade in from the far end of the volume and out as it passes the camera.
    state.camera.getWorldPosition(camPos);
    const starPos = anchor.current.getWorldPosition(scratch);
    const dist = starPos.distanceTo(camPos);
    let fade = (1 - THREE.MathUtils.smoothstep(dist, FAR * 0.68, FAR)) * THREE.MathUtils.smoothstep(dist, 1.5, 6);
    if (galaxy.focused === index) fade = 1;
    fade *= galaxy.intro;
    anchor.current.visible = fade > 0.01;

    planetU.uStarPos.value.copy(starPos);
    moonU.uStarPos.value.copy(starPos);
    for (const u of [planetU, moonU, starU, glowU]) setValue(u.uFade, fade);
    setValue(starU.uTime, starU.uTime.value + delta);
    setValue(glowU.uTime, glowU.uTime.value + delta);
    if (ringMat.current) ringMat.current.opacity = 0.32 * fade;
    if (orbitMat.current) orbitMat.current.opacity = 0.42 * fade;
    if (moonOrbitMat.current) moonOrbitMat.current.opacity = 0.22 * fade;

    // The moonlet that carries this project's name.
    if (labelMoon.current) {
      const r = look.size * 3.1;
      const a = index * 1.3 + t * Math.sqrt(0.25 / Math.pow(r, 3)) * 1.1;
      labelMoon.current.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    }
    if (label.current) {
      const hide = galaxy.focused >= 0 && galaxy.focused !== index;
      label.current.style.opacity = String(fade * (hide ? 0.15 : 1));
    }

    pivot.current.getWorldPosition(planetWorld[index]);
    starWorld[index].copy(scratch);
  });

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    galaxy.hovered = index;
    galaxy.onHover?.(index);
  };
  const onOut = () => {
    if (galaxy.hovered === index) {
      galaxy.hovered = -1;
      galaxy.onHover?.(-1);
    }
  };
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    down.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    // Only a click that didn't drag counts as choosing the planet.
    if (down.current && Math.hypot(e.clientX - down.current.x, e.clientY - down.current.y) < 6) {
      e.stopPropagation();
      galaxy.onSelect?.(index);
    }
    down.current = null;
  };

  return (
    <group ref={anchor}>
      {/* Star */}
      <mesh>
        <sphereGeometry args={[look.star.size, 32, 32]} />
        <shaderMaterial vertexShader={starVertex} fragmentShader={starFragment} uniforms={starU} transparent />
      </mesh>
      <Billboard>
        <mesh renderOrder={-1}>
          <planeGeometry args={[look.star.size * 9, look.star.size * 9]} />
          <shaderMaterial
            vertexShader={glowVertex}
            fragmentShader={glowFragment}
            uniforms={glowU}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </Billboard>

      {/* Orbital plane, inclined like real orbits */}
      <group rotation={[look.incline, 0, look.incline * 0.4]}>
        <lineLoop geometry={orbitLine}>
          <lineBasicMaterial ref={orbitMat} color={look.b} transparent opacity={0.42} depthWrite={false} />
        </lineLoop>

        <group ref={pivot}>
          {/* Larger invisible hit area so the planet is easy to point at */}
          <mesh onPointerOver={onOver} onPointerOut={onOut} onPointerDown={onDown} onPointerUp={onUp}>
            <sphereGeometry args={[look.size * 1.6, 16, 16]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>

          {/* Axial tilt, then spin around that tilted axis */}
          <group rotation={[0, 0, look.tilt]}>
            <group ref={spin}>
              {url ? (
                <Suspense fallback={null}>
                  <PlanetModel url={url} size={look.size} />
                </Suspense>
              ) : (
                <mesh>
                  <sphereGeometry args={[look.size, 64, 64]} />
                  <shaderMaterial vertexShader={planetVertex} fragmentShader={planetFragment} uniforms={planetU} transparent />
                </mesh>
              )}
            </group>
            {look.ring && !url && (
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[look.size * 1.4, look.size * 2.2, 128]} />
                <meshBasicMaterial ref={ringMat} color={look.b} transparent opacity={0.32} side={THREE.DoubleSide} depthWrite={false} />
              </mesh>
            )}
            {/* Paths of the moons, so you can see where they travel */}
            {moonPaths.map((g, k) => (
              <lineLoop key={`path-${k}`} geometry={g}>
                <lineBasicMaterial
                  ref={k === 0 ? moonOrbitMat : undefined}
                  color={look.b}
                  transparent
                  opacity={0.22}
                  depthWrite={false}
                />
              </lineLoop>
            ))}

            {/* A small moon that carries the project's name */}
            <group ref={labelMoon}>
              <mesh geometry={moonletGeometry} scale={look.size * 0.14}>
                <meshStandardMaterial color="#cfc7bb" roughness={1} flatShading />
              </mesh>
              <SpaceLabel labelRef={label} offset={[0, look.size * 0.32, 0]} scale={0.2 + look.size * 0.12}>
                <div className="-translate-y-1/2 text-center">
                  <span className="block text-[26px] font-semibold tracking-[-0.02em] [text-shadow:0_2px_14px_rgba(5,8,15,0.95)]">
                    {project?.title}
                  </span>
                  <span className="mt-1 block text-[13px] text-surface/65 [text-shadow:0_1px_10px_rgba(5,8,15,0.95)]">
                    {project ? `${project.org}, ${project.year}` : ""}
                  </span>
                </div>
              </SpaceLabel>
            </group>

            {/* Moons orbit in the planet's equatorial plane */}
            {moonOrbits.map((r, k) => (
              <group
                key={k}
                ref={(el) => {
                  moonRefs.current[k] = el;
                }}
              >
                <mesh>
                  <sphereGeometry args={[look.size * (0.16 + k * 0.05), 24, 24]} />
                  <shaderMaterial vertexShader={planetVertex} fragmentShader={planetFragment} uniforms={moonU} transparent />
                </mesh>
              </group>
            ))}
          </group>
        </group>
      </group>
    </group>
  );
}

function Dust({ count }: { count: number }) {
  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const h = (n: number) => {
        const v = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
        return v - Math.floor(v);
      };
      pos[i * 3] = (h(1) - 0.5) * VOLUME.x;
      pos[i * 3 + 1] = (h(2) - 0.5) * VOLUME.y;
      pos[i * 3 + 2] = LO_Z + h(3) * VOLUME.z;
      seed[i] = h(4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    return g;
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uOffset: { value: new THREE.Vector3() },
      uTile: { value: new THREE.Vector3(VOLUME.x, VOLUME.y, VOLUME.z) },
      uNear: { value: NEAR },
      uPixelRatio: { value: 1 },
    }),
    []
  );

  useFrame((state) => {
    uniforms.uOffset.value.set(galaxy.panX, galaxy.panY, galaxy.travel);
    uniforms.uPixelRatio.value = Math.min(state.gl.getPixelRatio(), 2);
  });

  // The vertex shader moves points far from their stored spot, so skip culling.
  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial vertexShader={dustVertex} fragmentShader={dustFragment} uniforms={uniforms} transparent depthWrite={false} />
    </points>
  );
}

function SpacetimeGrid({
  starWorld,
  planetWorld,
  holeWorld,
  narrow,
}: {
  starWorld: THREE.Vector3[];
  planetWorld: THREE.Vector3[];
  holeWorld: THREE.Vector3;
  narrow: boolean;
}) {
  const geometry = useMemo(() => {
    // A 3D lattice: lines along x, y and z, split into short segments so they can curve.
    const step = narrow ? 5 : 4; // distance between lattice lines
    const seg = 0.7; // segment length along a line
    const pos: number[] = [];
    const mid: number[] = [];
    const add = (a: number[], b: number[]) => {
      pos.push(...a, ...b);
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
      mid.push(...m, ...m);
    };
    const x0 = -VOLUME.x / 2;
    const y0 = -VOLUME.y / 2;
    for (let x = x0; x < x0 + VOLUME.x; x += step)
      for (let y = y0; y < y0 + VOLUME.y; y += step)
        for (let z = LO_Z; z < LO_Z + VOLUME.z; z += seg) add([x, y, z], [x, y, z + seg]);
    for (let y = y0; y < y0 + VOLUME.y; y += step)
      for (let z = LO_Z; z < LO_Z + VOLUME.z; z += step)
        for (let x = x0; x < x0 + VOLUME.x; x += seg) add([x, y, z], [x + seg, y, z]);
    for (let x = x0; x < x0 + VOLUME.x; x += step)
      for (let z = LO_Z; z < LO_Z + VOLUME.z; z += step)
        for (let y = y0; y < y0 + VOLUME.y; y += seg) add([x, y, z], [x, y + seg, z]);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aMid", new THREE.Float32BufferAttribute(mid, 3));
    return g;
  }, [narrow]);

  const uniforms = useMemo(
    () => ({
      uOffset: { value: new THREE.Vector3() },
      uTile: { value: new THREE.Vector3(VOLUME.x, VOLUME.y, VOLUME.z) },
      uNear: { value: NEAR },
      uMassPos: { value: Array.from({ length: MASS_SLOTS }, () => new THREE.Vector3(0, 0, 9999)) },
      // First half of the slots are stars, second half their planets. Bigger bodies bend more.
      uMass: {
        value: Array.from({ length: MASS_SLOTS }, (_, i) => {
          const half = MASS_SLOTS / 2;
          const sys = SYSTEMS[i % half];
          if (!sys || (i >= half && i - half >= SYSTEMS.length)) return 0;
          return i < half ? 1.1 + sys.star.size * 3 : 0.35 + sys.size * 1.1;
        }),
      },
      uTime: { value: 0 },
      uSpeed: { value: 0 },
      uHole: { value: new THREE.Vector3(0, 0, 9999) },
      uHoleMass: { value: BLACK_HOLE.gm },
      uWaveAge: { value: [-1, -1, -1] },
      uWave: { value: new THREE.Vector4(WAVES.speed, WAVES.width, WAVES.amplitude, 0) },
      uColor: { value: new THREE.Color("#4d66b3") },
      uBendColor: { value: new THREE.Color("#c9d8ff") },
    }),
    []
  );

  useFrame((_, delta) => {
    const half = MASS_SLOTS / 2;
    uniforms.uOffset.value.set(galaxy.panX, galaxy.panY, galaxy.travel);
    starWorld.forEach((p, i) => i < half && uniforms.uMassPos.value[i].copy(p));
    planetWorld.forEach((p, i) => i < half && uniforms.uMassPos.value[half + i].copy(p));
    uniforms.uHole.value.copy(holeWorld);
    // A new burst every few seconds; keep the last three alive as they spread.
    const t = uniforms.uTime.value;
    const ages = uniforms.uWaveAge.value;
    for (let k = 0; k < 3; k++) {
      const start = (Math.floor(t / WAVES.every) - k) * WAVES.every;
      ages.splice(k, 1, start >= 0 ? t - start : -1);
    }
    const speed = Math.hypot(galaxy.velX, galaxy.velY, galaxy.velZ);
    const target = THREE.MathUtils.smoothstep(speed, 2, 24) * galaxy.intro;
    setValue(uniforms.uSpeed, uniforms.uSpeed.value + (target - uniforms.uSpeed.value) * (1 - Math.exp(-5 * delta)));
    setValue(uniforms.uTime, uniforms.uTime.value + delta);
  });

  // The shader moves vertices far from their stored spot, so skip culling.
  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        vertexShader={gridVertex}
        fragmentShader={gridFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}

function Navigator({
  planetWorld,
  starWorld,
  narrow,
}: {
  planetWorld: THREE.Vector3[];
  starWorld: THREE.Vector3[];
  narrow: boolean;
}) {
  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const toStar = useMemo(() => new THREE.Vector3(), []);
  const viewDir = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);
  const lookNow = useRef(new THREE.Vector3(0, 0, -20));
  const sky = useRef<THREE.Group>(null);
  const prev = useRef({ travel: 0, panX: 0, panY: 0 });

  useFrame((state, delta) => {
    const ease = (rate: number) => 1 - Math.exp(-rate * delta);

    if (galaxy.focused < 0) {
      // Glide on after input stops, and drift forward gently when idle.
      if (!galaxy.dragging) {
        galaxy.targetPanX += galaxy.panVX;
        galaxy.targetPanY += galaxy.panVY;
        galaxy.panVX *= Math.exp(-3 * delta);
        galaxy.panVY *= Math.exp(-3 * delta);
      }
      galaxy.targetTravel += galaxy.travelVel * delta;
      galaxy.travelVel *= Math.exp(-1.6 * delta);
      if (galaxy.hovered < 0) galaxy.targetTravel += 1.8 * delta * galaxy.intro * galaxy.drift;

      galaxy.travel += (galaxy.targetTravel - galaxy.travel) * ease(4.5);
      galaxy.panX += (galaxy.targetPanX - galaxy.panX) * ease(5);
      galaxy.panY += (galaxy.targetPanY - galaxy.panY) * ease(5);
    }

    // Measure how fast the view is moving, smoothed so streaks grow and fade softly.
    const dt = Math.max(delta, 1 / 240);
    const k = ease(10);
    galaxy.velX += ((galaxy.panX - prev.current.panX) / dt - galaxy.velX) * k;
    galaxy.velY += ((galaxy.panY - prev.current.panY) / dt - galaxy.velY) * k;
    galaxy.velZ += ((galaxy.travel - prev.current.travel) / dt - galaxy.velZ) * k;
    prev.current = { travel: galaxy.travel, panX: galaxy.panX, panY: galaxy.panY };

    const cam = state.camera;
    if (galaxy.focused >= 0) {
      const p = planetWorld[galaxy.focused];
      const size = SYSTEMS[galaxy.focused % SYSTEMS.length].size;
      // Come in close: the planet fills a large part of the screen.
      const dist = size * (narrow ? 5.6 : 4.4);
      const halfH = Math.tan((((cam as THREE.PerspectiveCamera).fov * Math.PI) / 180) / 2) * dist;
      const halfW = (halfH * state.size.width) / state.size.height;

      // View it from the star's side so we see its lit face, not its night side.
      toStar.subVectors(starWorld[galaxy.focused], p).normalize();
      viewDir.set(0, 0.15, 1).normalize().lerp(toStar, 0.55).normalize();
      right.crossVectors(up, viewDir).normalize();

      // Shift the frame so the planet sits left of the details panel on desktop,
      // and in the upper part of the screen above the panel on phones.
      const side = narrow ? 0 : halfW * 0.45;
      const drop = narrow ? halfH * 0.42 : 0;
      lookTarget.copy(p).addScaledVector(right, side);
      lookTarget.setY(lookTarget.y - drop);
      camTarget.copy(lookTarget).addScaledVector(viewDir, dist);
    } else {
      // Look around a little with the mouse.
      camTarget.set(state.pointer.x * 0.6, state.pointer.y * 0.4, 0);
      lookTarget.set(state.pointer.x * 3, state.pointer.y * 2, -20);
    }
    const rate = galaxy.focused >= 0 ? 2.4 : 4;
    cam.position.lerp(camTarget, ease(rate));
    lookNow.current.lerp(lookTarget, ease(rate));
    cam.lookAt(lookNow.current);

    // World units per pixel at mid depth, so dragging feels 1:1.
    const fov = ((cam as THREE.PerspectiveCamera).fov * Math.PI) / 180;
    galaxy.unitsPerPixel = (2 * Math.tan(fov / 2) * 18) / state.size.height;

    // The project most centred in view, for the caption.
    let best = -1;
    let bestScore = Infinity;
    planetWorld.forEach((p, i) => {
      if (p.z > -3 || p.z < -45) return;
      const score = Math.hypot(p.x, p.y) / -p.z + -p.z * 0.004;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    });
    if (best !== galaxy.nearest) {
      galaxy.nearest = best;
      galaxy.onNearest?.(best);
    }

    // Distant stars barely shift, which reads as great depth.
    if (sky.current) {
      sky.current.rotation.y = galaxy.panX * 0.003;
      sky.current.rotation.x = -galaxy.panY * 0.003;
    }
  });

  return (
    <group ref={sky}>
      <Starfield count={narrow ? 1600 : 3200} />
    </group>
  );
}

export default function GalaxyScene({
  reducedMotion,
  eventSource,
}: {
  reducedMotion: boolean;
  eventSource: RefObject<HTMLElement | null>;
}) {
  const [narrow, setNarrow] = useState(false);
  const [finePointer, setFinePointer] = useState(false);
  useEffect(() => {
    galaxy.drift = reducedMotion ? 0 : 1;
  }, [reducedMotion]);
  // The wormhole cursor is for mouse and trackpad users who allow motion.
  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    const update = () => setFinePointer(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const bases = useMemo(() => basePositions(work.length), []);
  const planetWorld = useMemo(() => bases.map(() => new THREE.Vector3(0, 0, -999)), [bases]);
  const starWorld = useMemo(() => bases.map(() => new THREE.Vector3(0, 0, -999)), [bases]);
  const holeWorld = useMemo(() => new THREE.Vector3(0, 0, 9999), []);

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
      camera={{ position: [0, 0, 0], fov: 50, near: 0.1, far: 300 }}
      gl={{ antialias: true }}
      // Output colours as-is, so the black hole's lensed copy of the scene
      // matches what is drawn directly (custom shaders already work this way).
      linear
      flat
      eventSource={eventSource as RefObject<HTMLElement>}
      eventPrefix="client"
      fallback={null}
    >
      <color attach="background" args={[0.02, 0.031, 0.059]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[-20, 12, 10]} intensity={1.8} />
      <Navigator planetWorld={planetWorld} starWorld={starWorld} narrow={narrow} />
      <Dust count={narrow ? 1800 : 3500} />
      <SpacetimeGrid starWorld={starWorld} planetWorld={planetWorld} holeWorld={holeWorld} narrow={narrow} />
      {bases.map((b, i) => (
        <ProjectSystem key={i} index={i} look={SYSTEMS[i % SYSTEMS.length]} base={b} planetWorld={planetWorld} starWorld={starWorld} />
      ))}
      <AsteroidField count={narrow ? 160 : 320} />
      <TextAsteroids narrow={narrow} />
      {/* Last, so it can render everything else first and bend it. */}
      <BlackHole worldOut={holeWorld} />
      {/* The wormhole cursor takes over the final render on mouse and trackpad devices. */}
      {finePointer && !reducedMotion && <WormholeCursor />}
    </Canvas>
  );
}
