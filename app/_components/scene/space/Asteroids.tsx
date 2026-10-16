"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { galaxy } from "./galaxyState";
import { NEAR, VOLUME } from "./systems";
import { profile } from "../../../content";

const LO_Z = NEAR - VOLUME.z;
const FAR = VOLUME.z - NEAR;
const wrapCentered = (v: number, size: number) => ((((v + size / 2) % size) + size) % size) - size / 2;
const wrapDepth = (z: number) => LO_Z + ((((z - LO_Z) % VOLUME.z) + VOLUME.z) % VOLUME.z);

const hashAt = (i: number, n: number) => {
  const v = Math.sin(i * 91.345 + n * 47.853) * 43758.5453;
  return v - Math.floor(v);
};

/** A lumpy rock: an icosphere pushed in and out by layered noise. */
export function makeRockGeometry(seed: number, detail = 2) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, detail));
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const n =
      Math.sin(v.x * 3.1 + seed) * Math.cos(v.y * 2.7 - seed * 0.7) * 0.18 +
      Math.sin(v.z * 5.3 + seed * 1.9) * 0.09 +
      Math.sin((v.x + v.y) * 9.0 + seed * 3.1) * 0.04;
    v.multiplyScalar(1 + n);
    v.y *= 0.78 + (seed % 1) * 0.3; // slightly squashed, never a perfect ball
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Distance fade shared by everything that lives in the wrapping volume. */
export function volumeFade(dist: number) {
  return (1 - THREE.MathUtils.smoothstep(dist, FAR * 0.68, FAR)) * THREE.MathUtils.smoothstep(dist, 1.2, 5);
}

/** Asteroids scattered through the whole galaxy, tumbling slowly. */
export function AsteroidField({ count }: { count: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => makeRockGeometry(4.2, 1), []);
  const rocks = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        base: new THREE.Vector3(
          (hashAt(i, 1) - 0.5) * VOLUME.x,
          (hashAt(i, 2) - 0.5) * VOLUME.y,
          LO_Z + hashAt(i, 3) * VOLUME.z
        ),
        // Mostly pebbles, a few big ones.
        size: 0.05 + Math.pow(hashAt(i, 4), 4) * 0.45,
        axis: new THREE.Vector3(hashAt(i, 5) - 0.5, hashAt(i, 6) - 0.5, hashAt(i, 7) - 0.5).normalize(),
        spin: 0.1 + hashAt(i, 8) * 0.5,
        phase: hashAt(i, 9) * 6.28,
      })),
    [count]
  );
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const s = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    if (!mesh.current) return;
    const t = state.clock.elapsedTime;
    const cam = state.camera.position;
    rocks.forEach((r, i) => {
      p.set(
        wrapCentered(r.base.x + galaxy.panX, VOLUME.x),
        wrapCentered(r.base.y + galaxy.panY, VOLUME.y),
        wrapDepth(r.base.z + galaxy.travel)
      );
      const fade = volumeFade(p.distanceTo(cam)) * galaxy.intro;
      q.setFromAxisAngle(r.axis, r.phase + t * r.spin);
      s.setScalar(r.size * fade);
      m.compose(p, q, s);
      mesh.current!.setMatrixAt(i, m);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial color="#bdb5aa" roughness={1} metalness={0} flatShading />
    </instancedMesh>
  );
}

/** A ring of rocks orbiting the black hole, faster on the inside (Kepler). */
export function AsteroidBelt({ count, inner, outer }: { count: number; inner: number; outer: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => makeRockGeometry(7.7, 1), []);
  const rocks = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        r: inner + hashAt(i, 11) * (outer - inner),
        a: hashAt(i, 12) * Math.PI * 2,
        y: (hashAt(i, 13) - 0.5) * 0.9,
        size: 0.06 + Math.pow(hashAt(i, 14), 3) * 0.3,
        axis: new THREE.Vector3(hashAt(i, 15) - 0.5, hashAt(i, 16) - 0.5, hashAt(i, 17) - 0.5).normalize(),
      })),
    [count, inner, outer]
  );
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const s = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    if (!mesh.current) return;
    const t = state.clock.elapsedTime;
    rocks.forEach((r, i) => {
      const omega = 9 / Math.pow(r.r, 1.5);
      const a = r.a + t * omega * 0.25;
      p.set(Math.cos(a) * r.r, r.y, Math.sin(a) * r.r);
      q.setFromAxisAngle(r.axis, t * 0.4 + i);
      s.setScalar(r.size * galaxy.intro);
      m.compose(p, q, s);
      mesh.current!.setMatrixAt(i, m);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial color="#c9bfb3" roughness={1} metalness={0} flatShading />
    </instancedMesh>
  );
}

/** A floating text label that always faces the camera and fades with distance. */
export function SpaceLabel({
  children,
  offset = [0, 0, 0],
  scale = 1,
  labelRef,
}: {
  children: React.ReactNode;
  offset?: [number, number, number];
  scale?: number;
  labelRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <Html
      position={offset}
      transform
      sprite
      scale={scale}
      zIndexRange={[5, 0]}
      pointerEvents="none"
      style={{ pointerEvents: "none" }}
    >
      <div ref={labelRef} className="select-none whitespace-nowrap text-surface" style={{ opacity: 0 }}>
        {children}
      </div>
    </Html>
  );
}

type TextRock = { text: string; kind: "headline" | "note"; pos: [number, number, number]; size: number };

/**
 * The intro, written on asteroids drifting at the start of the journey: one
 * headline line per rock, plus the availability note and how to get around.
 */
export function TextAsteroids({ narrow }: { narrow: boolean }) {
  const rocks: TextRock[] = useMemo(() => {
    // Positions are where they sit once the opening fly-in has finished.
    const x = narrow ? -0.6 : -4.2;
    const lines = profile.headline.map(
      (text, i): TextRock => ({
        text,
        kind: "headline",
        pos: [x + i * (narrow ? 0.15 : 0.35), 2.2 - i * (narrow ? 1.25 : 1.15), -40 - i * 0.6],
        size: 0.32 - i * 0.02,
      })
    );
    return [
      ...lines,
      { text: profile.availability, kind: "note", pos: [x + 0.4, -2.7, -41.5], size: 0.18 },
      {
        text: "Scroll to fly, drag to look around, click a planet to explore",
        kind: "note",
        pos: [x + 0.7, -3.7, -42.5],
        size: 0.14,
      },
    ];
  }, [narrow]);

  return (
    <>
      {rocks.map((r, i) => (
        <TextRockItem key={i} rock={r} index={i} narrow={narrow} />
      ))}
    </>
  );
}

function TextRockItem({ rock, index, narrow }: { rock: TextRock; index: number; narrow: boolean }) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const label = useRef<HTMLDivElement>(null);
  const geometry = useMemo(() => makeRockGeometry(index * 2.3 + 1.1, 2), [index]);
  const base = useMemo(() => new THREE.Vector3(rock.pos[0], rock.pos[1], rock.pos[2]), [rock]);
  const world = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    if (!group.current || !body.current) return;
    const t = state.clock.elapsedTime;
    group.current.position.set(
      wrapCentered(base.x + galaxy.panX, VOLUME.x),
      wrapCentered(base.y + galaxy.panY + Math.sin(t * 0.5 + index) * 0.08, VOLUME.y),
      wrapDepth(base.z + galaxy.travel)
    );
    body.current.rotation.x += delta * 0.12;
    body.current.rotation.y += delta * 0.18;
    group.current.getWorldPosition(world);
    const fade = volumeFade(world.distanceTo(state.camera.position)) * galaxy.intro;
    group.current.visible = fade > 0.01;
    if (label.current) label.current.style.opacity = String(fade * (galaxy.focused >= 0 ? 0.25 : 1));
  });

  const headline = rock.kind === "headline";
  return (
    <group ref={group}>
      <mesh ref={body} geometry={geometry} scale={rock.size}>
        <meshStandardMaterial color="#b3aba0" roughness={1} flatShading />
      </mesh>
      {/* Text sits just right of its rock, as if painted along its face. */}
      <SpaceLabel labelRef={label} offset={[rock.size * 1.4, 0, 0.2]} scale={narrow ? 0.16 : 0.2}>
        <div style={{ transform: "translateX(50%)" }}>
          {headline ? (
            <span className="block text-[38px] font-semibold leading-none tracking-[-0.035em] [text-shadow:0_2px_18px_rgba(5,8,15,0.9)]">
              {rock.text}
            </span>
          ) : (
            <span
              className="block text-[26px] leading-snug text-surface/85 [text-shadow:0_1px_12px_rgba(5,8,15,0.9)]"
              // On phones the notes wrap so they stay on screen.
              style={narrow ? { whiteSpace: "normal", width: 420 } : undefined}
            >
              {rock.text}
            </span>
          )}
        </div>
      </SpaceLabel>
    </group>
  );
}
