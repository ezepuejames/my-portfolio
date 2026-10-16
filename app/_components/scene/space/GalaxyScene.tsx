"use client";

import { RefObject, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useFrame } from "@react-three/fiber";
import { Center, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import Starfield from "./Starfield";
import { glowFragment, glowVertex, planetFragment, planetVertex } from "./spaceShaders";
import { galaxy } from "./galaxyState";
import { sceneState } from "../store";
import { work } from "../../../content";

// The galaxy is one tile of planets repeated forever in every direction.
// Each planet wraps to the opposite edge once it leaves the tile, so panning never ends.
const TILE_W = 26;
const TILE_H = 16;
const CAMERA_Z = 15;
const AUTO_DRIFT = { x: 0.22, y: 0.06 }; // units per second when idle

// Visual style per project, in the same order as `work` in content.ts.
const LOOKS: { size: number; a: string; b: string; bands: number; ring?: boolean }[] = [
  { size: 1.05, a: "#1d3fae", b: "#9cc2ff", bands: 7, ring: true }, // AGM platform
  { size: 0.9, a: "#7a3b16", b: "#f2b26b", bands: 11 }, // The Energy Vanguard
  { size: 0.8, a: "#2a5f3a", b: "#bfe6b0", bands: 5 }, // Brillianda
  { size: 0.72, a: "#3b2a6b", b: "#c7b8ff", bands: 9 }, // RouteLink MFB
  { size: 0.7, a: "#0f5a66", b: "#9ff0f0", bands: 6 }, // RoutePay
  { size: 0.62, a: "#6b6f78", b: "#e3ddd2", bands: 4 }, // Crafwell
  { size: 0.68, a: "#5a1e2f", b: "#ff9fb0", bands: 13, ring: true }, // DeFi Shield
  { size: 0.5, a: "#4a4f22", b: "#e8e39a", bands: 8 }, // Lead Radar
  { size: 0.56, a: "#7a2d14", b: "#ffc49c", bands: 10 }, // YouMeHungry
  { size: 0.5, a: "#2b3a55", b: "#c8d6ee", bands: 5 }, // Global Harvest
  { size: 0.5, a: "#6b2a5c", b: "#f6b8e4", bands: 7 }, // HerRising
];

/** Spreads the projects over the tile on a jittered grid so spacing feels natural. */
function basePositions(count: number) {
  const cols = 4;
  const rows = Math.ceil(count / cols);
  const cw = TILE_W / cols;
  const ch = TILE_H / rows;
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const h = (n: number) => {
      const v = Math.sin(i * 91.7 + n * 37.3) * 43758.5453;
      return v - Math.floor(v);
    };
    // Offset alternate rows so planets don't line up in columns.
    const x = -TILE_W / 2 + (c + 0.5 + (r % 2) * 0.5) * cw + (h(1) - 0.5) * cw * 0.45;
    const y = TILE_H / 2 - (r + 0.5) * ch + (h(2) - 0.5) * ch * 0.4;
    const z = (h(3) - 0.5) * 3;
    out.push(new THREE.Vector3(x, y, z));
  }
  return out;
}

const wrap = (v: number, size: number) => ((((v + size / 2) % size) + size) % size) - size / 2;

function PlanetModel({ url, size }: { url: string; size: number }) {
  const { scene } = useGLTF(url);
  const copy = useMemo(() => scene.clone(true), [scene]);
  return (
    <Center>
      <primitive object={copy} scale={size} />
    </Center>
  );
}

function PlanetSurface({ index }: { index: number }) {
  const look = LOOKS[index % LOOKS.length];
  const uniforms = useMemo(
    () => ({
      uColorA: { value: new THREE.Color(look.a) },
      uColorB: { value: new THREE.Color(look.b) },
      uStarPos: { value: new THREE.Vector3(-30, 18, 26) }, // a distant sun, top left
      uSeed: { value: index * 1.618 + 0.4 },
      uBands: { value: look.bands },
    }),
    [look, index]
  );
  return (
    <mesh>
      <sphereGeometry args={[look.size, 64, 64]} />
      <shaderMaterial vertexShader={planetVertex} fragmentShader={planetFragment} uniforms={uniforms} />
    </mesh>
  );
}

function ProjectPlanet({
  index,
  base,
  positions,
}: {
  index: number;
  base: THREE.Vector3;
  positions: THREE.Vector3[];
}) {
  const look = LOOKS[index % LOOKS.length];
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const halo = useRef<THREE.ShaderMaterial>(null);
  const url = work[index]?.model ?? null;
  const down = useRef<{ x: number; y: number } | null>(null);

  const haloUniforms = useMemo(
    () => ({ uTime: { value: 0 }, uColor: { value: new THREE.Color(look.b) } }),
    [look]
  );

  useFrame((_, delta) => {
    if (!group.current || !body.current) return;
    const p = positions[index];
    p.set(wrap(base.x + galaxy.x, TILE_W), wrap(base.y + galaxy.y, TILE_H), base.z);
    group.current.position.copy(p);

    // Lean into the direction of travel, like the tilt in a drag gallery.
    const tiltX = THREE.MathUtils.clamp(-galaxy.vy * 0.9, -0.5, 0.5);
    const tiltY = THREE.MathUtils.clamp(galaxy.vx * 0.9, -0.5, 0.5);
    group.current.rotation.x += (tiltX - group.current.rotation.x) * 0.1;
    group.current.rotation.y += (tiltY - group.current.rotation.y) * 0.1;
    body.current.rotation.y += delta * (0.15 + (index % 3) * 0.05);

    const active = galaxy.hovered === index || galaxy.focused === index;
    const s = THREE.MathUtils.lerp(group.current.scale.x, active ? 1.12 : 1, 1 - Math.exp(-8 * delta));
    group.current.scale.setScalar(s * (0.4 + 0.6 * sceneState.intro));
    if (halo.current) {
      halo.current.uniforms.uTime.value += delta;
    }
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
    // Only a click that didn't drag counts as selecting the planet.
    if (down.current && Math.hypot(e.clientX - down.current.x, e.clientY - down.current.y) < 6) {
      e.stopPropagation();
      galaxy.onSelect?.(index);
    }
    down.current = null;
  };

  return (
    <group ref={group}>
      {/* Invisible, slightly larger hit area so planets are easy to point at. */}
      <mesh onPointerOver={onOver} onPointerOut={onOut} onPointerDown={onDown} onPointerUp={onUp}>
        <sphereGeometry args={[look.size * 1.25, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <group ref={body} rotation={[0.3, 0, 0.15]}>
        {url ? (
          <Suspense fallback={<PlanetSurface index={index} />}>
            <PlanetModel url={url} size={look.size} />
          </Suspense>
        ) : (
          <PlanetSurface index={index} />
        )}
        {look.ring && !url && (
          <mesh rotation={[Math.PI / 2.3, 0, 0]}>
            <ringGeometry args={[look.size * 1.45, look.size * 2.1, 96]} />
            <meshBasicMaterial color={look.b} transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        )}
      </group>
      <mesh renderOrder={-1}>
        <planeGeometry args={[look.size * 4.2, look.size * 4.2]} />
        <shaderMaterial
          ref={halo}
          vertexShader={glowVertex}
          fragmentShader={glowFragment}
          uniforms={haloUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function Rig({ positions, narrow }: { positions: THREE.Vector3[]; narrow: boolean }) {
  const target = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const lookCurrent = useRef(new THREE.Vector3());
  const starfield = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    const k = 1 - Math.exp(-6 * delta);

    // Pan: idle drift, drag target, then inertia after release.
    if (galaxy.focused < 0) {
      if (!galaxy.dragging) {
        galaxy.targetX += galaxy.vx;
        galaxy.targetY += galaxy.vy;
        galaxy.vx *= Math.exp(-3 * delta);
        galaxy.vy *= Math.exp(-3 * delta);
        if (!sceneState.pointerActive || galaxy.hovered < 0) {
          galaxy.targetX -= AUTO_DRIFT.x * delta * sceneState.intro;
          galaxy.targetY += AUTO_DRIFT.y * delta * sceneState.intro;
        }
      }
      galaxy.x += (galaxy.targetX - galaxy.x) * k;
      galaxy.y += (galaxy.targetY - galaxy.y) * k;
    }

    // Camera: hover the field, or fly to the focused planet.
    const cam = state.camera;
    const baseZ = (narrow ? CAMERA_Z + 5 : CAMERA_Z) + (1 - sceneState.intro) * 18 + sceneState.scroll * 8;
    if (galaxy.focused >= 0) {
      const p = positions[galaxy.focused];
      const size = LOOKS[galaxy.focused % LOOKS.length].size;
      // Leave room on the right for the details panel on desktop.
      const dx = narrow ? 0 : size * 2.4;
      const dy = narrow ? -size * 2 : 0;
      target.set(p.x + dx, p.y + dy, p.z + size * 7);
      look.set(p.x + dx, p.y + dy, p.z);
    } else {
      target.set(state.pointer.x * 0.5, state.pointer.y * 0.3, baseZ);
      look.set(0, 0, 0);
    }
    const kc = 1 - Math.exp(-3.2 * delta);
    cam.position.lerp(target, kc);
    lookCurrent.current.lerp(look, kc);
    cam.lookAt(lookCurrent.current);

    // World units per screen pixel at the planets' depth, for 1:1 dragging.
    const dist = Math.max(cam.position.z, 1);
    const fov = ((cam as THREE.PerspectiveCamera).fov * Math.PI) / 180;
    galaxy.unitsPerPixel = (2 * Math.tan(fov / 2) * dist) / state.size.height;

    // Which project is nearest the centre of the screen.
    let best = -1;
    let bestD = Infinity;
    positions.forEach((p, i) => {
      const d = p.x * p.x + p.y * p.y;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best !== galaxy.nearest) {
      galaxy.nearest = best;
      galaxy.onNearest?.(best);
    }

    // Stars drift slower than planets for depth.
    if (starfield.current) {
      starfield.current.position.x = galaxy.x * 0.04;
      starfield.current.position.y = galaxy.y * 0.04;
    }
  });

  return (
    <group ref={starfield}>
      <Starfield count={narrow ? 1500 : 3000} />
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
  const bases = useMemo(() => basePositions(work.length), []);
  const positions = useMemo(() => bases.map((b) => b.clone()), [bases]);

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
      camera={{ position: [0, 0, 32], fov: 40 }}
      frameloop={reducedMotion ? "demand" : "always"}
      gl={{ antialias: true }}
      eventSource={eventSource as RefObject<HTMLElement>}
      eventPrefix="client"
      fallback={null}
    >
      <color attach="background" args={["#060b16"]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[-30, 18, 26]} intensity={2.2} />
      <Rig positions={positions} narrow={narrow} />
      {bases.map((b, i) => (
        <ProjectPlanet key={i} index={i} base={b} positions={positions} />
      ))}
    </Canvas>
  );
}
