"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { blackHoleFragment, blackHoleVertex } from "./blackHoleShaders";
import { galaxy } from "./galaxyState";
import { BLACK_HOLE, NEAR, VOLUME } from "./systems";
import { AsteroidBelt } from "./Asteroids";

const LO_Z = NEAR - VOLUME.z;
const wrapCentered = (v: number, size: number) => ((((v + size / 2) % size) + size) % size) - size / 2;
const wrapDepth = (z: number) => LO_Z + ((((z - LO_Z) % VOLUME.z) + VOLUME.z) % VOLUME.z);

/**
 * The black hole. Each frame it renders the rest of the scene into a texture,
 * then draws a sphere whose shader traces light through curved spacetime and
 * looks that texture up wherever the bent rays end, which is what makes the
 * lensing real: the actual planets, stars and grid behind it are distorted.
 * The extra render only happens while the black hole is on screen.
 */
export default function BlackHole({ worldOut }: { worldOut: THREE.Vector3 }) {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const { gl, size } = useThree();

  const target = useMemo(() => {
    const t = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
    t.depthTexture = new THREE.DepthTexture(1, 1);
    t.depthTexture.type = THREE.UnsignedIntType;
    return t;
  }, []);

  useEffect(() => {
    const dpr = Math.min(gl.getPixelRatio(), 2);
    // Render the lensed copy at a slightly lower resolution to keep it fast.
    const scale = 0.75;
    target.setSize(Math.max(1, Math.floor(size.width * dpr * scale)), Math.max(1, Math.floor(size.height * dpr * scale)));
    return undefined;
  }, [gl, size, target]);

  useEffect(() => () => target.dispose(), [target]);

  const uniforms = useMemo(
    () => ({
      uScene: { value: target.texture },
      uDepth: { value: target.depthTexture },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uViewProj: { value: new THREE.Matrix4() },
      uModel: { value: new THREE.Matrix4() },
      uCamLocal: { value: new THREE.Vector3() },
      uCamNear: { value: 0.1 },
      uCamFar: { value: 300 },
      uRadius: { value: BLACK_HOLE.lensRadius },
      uTime: { value: 0 },
      uDiskIn: { value: 3 },
      uDiskOut: { value: BLACK_HOLE.diskOuter },
      uFade: { value: 1 },
    }),
    [target]
  );

  const ndc = useMemo(() => new THREE.Vector3(), []);
  const camLocal = useMemo(() => new THREE.Vector3(), []);
  const drawSize = useMemo(() => new THREE.Vector2(), []);

  useFrame((state, delta) => {
    const g = group.current;
    const m = mesh.current;
    if (!g || !m) return;

    // Place it in the wrapping volume like everything else.
    g.position.set(
      wrapCentered(BLACK_HOLE.position[0] + galaxy.panX, VOLUME.x),
      wrapCentered(BLACK_HOLE.position[1] + galaxy.panY, VOLUME.y),
      wrapDepth(BLACK_HOLE.position[2] + galaxy.travel)
    );
    g.updateMatrixWorld();
    m.getWorldPosition(worldOut);

    const cam = state.camera as THREE.PerspectiveCamera;
    const dist = worldOut.distanceTo(cam.position);
    const worldRadius = BLACK_HOLE.lensRadius * BLACK_HOLE.rs;

    // Skip all the work when it is behind the camera, off screen or very far.
    ndc.copy(worldOut).project(cam);
    const behind = ndc.z > 1;
    const angular = worldRadius / Math.max(dist, 0.001);
    const onScreen = !behind && Math.abs(ndc.x) < 1 + angular * 3 && Math.abs(ndc.y) < 1 + angular * 3;
    const far = VOLUME.z - NEAR;
    const fade = (1 - THREE.MathUtils.smoothstep(dist, far * 0.6, far * 0.95)) * galaxy.intro;
    const active = onScreen && fade > 0.01 && dist > 0.5;
    m.visible = false;
    if (!active) return;

    // 1. Render everything else into the texture the shader will bend.
    const prevTarget = gl.getRenderTarget();
    gl.setRenderTarget(target);
    gl.clear();
    gl.render(state.scene, cam);
    gl.setRenderTarget(prevTarget);
    m.visible = true;

    // 2. Hand the shader the camera and transforms it needs.
    const u = (m.material as THREE.ShaderMaterial).uniforms;
    u.uViewProj.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    u.uModel.value.copy(m.matrixWorld);
    camLocal.copy(cam.position);
    m.worldToLocal(camLocal);
    u.uCamLocal.value.copy(camLocal);
    u.uCamNear.value = cam.near;
    u.uCamFar.value = cam.far;
    gl.getDrawingBufferSize(drawSize);
    u.uResolution.value.copy(drawSize);
    u.uTime.value += delta;
    u.uFade.value = fade;
  });

  return (
    <group ref={group}>
      {/* Tilted so the disk is seen slightly from above, like the classic image. */}
      <mesh ref={mesh} scale={BLACK_HOLE.rs} rotation={[0.22, 0, -0.12]} renderOrder={999} frustumCulled={false}>
        <sphereGeometry args={[BLACK_HOLE.lensRadius, 48, 48]} />
        <shaderMaterial
          vertexShader={blackHoleVertex}
          fragmentShader={blackHoleFragment}
          uniforms={uniforms}
          side={THREE.BackSide}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      {/* An asteroid belt circling well outside the accretion disk. */}
      <group rotation={[0.22, 0, -0.12]}>
        <AsteroidBelt count={260} inner={14} outer={17.5} />
      </group>
    </group>
  );
}
