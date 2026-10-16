import * as THREE from "three";
import {
  advectionShader,
  baseVertex,
  clearShader,
  compositeShader,
  curlShader,
  divergenceShader,
  gradientSubtractShader,
  pressureShader,
  splatShader,
  vorticityShader,
} from "./fluidShaders";

const SETTINGS = {
  simResolution: 128,
  dyeResolution: 256,
  velocityDissipation: 2.6, // how quickly the swirl dies down
  dyeDissipation: 2.2,
  pressure: 0.8,
  pressureIterations: 18,
  curl: 16, // how much it curls into vortices
  splatRadius: 0.0022,
  splatForce: 3600,
};

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
  const t = { read: makeTarget(w, h), write: makeTarget(w, h), swap: () => {} };
  t.swap = () => {
    const tmp = t.read;
    t.read = t.write;
    t.write = tmp;
  };
  return t;
}

function material(fragmentShader: string, uniforms: Record<string, THREE.IUniform>) {
  return new THREE.ShaderMaterial({
    vertexShader: baseVertex,
    fragmentShader,
    uniforms: { texelSize: { value: new THREE.Vector2() }, ...uniforms },
    depthTest: false,
    depthWrite: false,
  });
}

/**
 * A small GPU fluid simulation stirred by the mouse, and the pass that uses it
 * to distort the rendered galaxy and open a wormhole at the cursor.
 */
export class FluidSim {
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private scene = new THREE.Scene();
  private quad: THREE.Mesh;
  private velocity: DoubleTarget;
  private dye: DoubleTarget;
  private pressure: DoubleTarget;
  private divergence: THREE.WebGLRenderTarget;
  private curl: THREE.WebGLRenderTarget;
  private simTexel = new THREE.Vector2();
  private dyeTexel = new THREE.Vector2();
  readonly sceneTarget: THREE.WebGLRenderTarget;

  private m = {
    clear: material(clearShader, { uTexture: { value: null }, value: { value: 0 } }),
    splat: material(splatShader, {
      uTarget: { value: null },
      aspectRatio: { value: 1 },
      color: { value: new THREE.Vector3() },
      point: { value: new THREE.Vector2() },
      radius: { value: 0 },
    }),
    advection: material(advectionShader, {
      uVelocity: { value: null },
      uSource: { value: null },
      dt: { value: 0 },
      dissipation: { value: 0 },
    }),
    divergence: material(divergenceShader, { uVelocity: { value: null } }),
    curl: material(curlShader, { uVelocity: { value: null } }),
    vorticity: material(vorticityShader, {
      uVelocity: { value: null },
      uCurl: { value: null },
      curl: { value: SETTINGS.curl },
      dt: { value: 0 },
    }),
    pressure: material(pressureShader, { uPressure: { value: null }, uDivergence: { value: null } }),
    gradient: material(gradientSubtractShader, { uPressure: { value: null }, uVelocity: { value: null } }),
    composite: material(compositeShader, {
      uScene: { value: null },
      uVelocity: { value: null },
      uDye: { value: null },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uAspect: { value: 1 },
      uRadius: { value: 0 },
      uTime: { value: 0 },
    }),
  };

  constructor(width: number, height: number) {
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.m.clear);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);

    const aspect = width / height;
    const sim = this.size(SETTINGS.simResolution, aspect);
    const dye = this.size(SETTINGS.dyeResolution, aspect);
    this.velocity = makeDouble(sim.w, sim.h);
    this.pressure = makeDouble(sim.w, sim.h);
    this.divergence = makeTarget(sim.w, sim.h);
    this.curl = makeTarget(sim.w, sim.h);
    this.dye = makeDouble(dye.w, dye.h);
    this.simTexel.set(1 / sim.w, 1 / sim.h);
    this.dyeTexel.set(1 / dye.w, 1 / dye.h);

    this.sceneTarget = new THREE.WebGLRenderTarget(width, height, { depthBuffer: true });
  }

  private size(res: number, aspect: number) {
    const min = Math.round(res);
    const max = Math.round(res * Math.max(aspect, 1 / aspect));
    return aspect >= 1 ? { w: max, h: min } : { w: min, h: max };
  }

  resize(width: number, height: number) {
    this.sceneTarget.setSize(Math.max(1, width), Math.max(1, height));
  }

  private pass(gl: THREE.WebGLRenderer, mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null, texel: THREE.Vector2) {
    mat.uniforms.texelSize.value.copy(texel);
    this.quad.material = mat;
    gl.setRenderTarget(target);
    gl.render(this.scene, this.camera);
  }

  /** Stir the fluid at a point (0..1 screen space) with a velocity in screen units. */
  splat(gl: THREE.WebGLRenderer, x: number, y: number, dx: number, dy: number, aspect: number) {
    const s = this.m.splat.uniforms;
    s.aspectRatio.value = aspect;
    s.point.value.set(x, y);
    s.radius.value = SETTINGS.splatRadius * (aspect > 1 ? aspect : 1);

    s.uTarget.value = this.velocity.read.texture;
    s.color.value.set(dx * SETTINGS.splatForce, dy * SETTINGS.splatForce, 0);
    this.pass(gl, this.m.splat, this.velocity.write, this.simTexel);
    this.velocity.swap();

    s.uTarget.value = this.dye.read.texture;
    const e = Math.min(Math.hypot(dx, dy) * 40, 0.6);
    s.color.value.set(e, e, e);
    this.pass(gl, this.m.splat, this.dye.write, this.dyeTexel);
    this.dye.swap();
  }

  /** Advance the simulation one step. */
  step(gl: THREE.WebGLRenderer, dt: number) {
    const m = this.m;
    m.curl.uniforms.uVelocity.value = this.velocity.read.texture;
    this.pass(gl, m.curl, this.curl, this.simTexel);

    m.vorticity.uniforms.uVelocity.value = this.velocity.read.texture;
    m.vorticity.uniforms.uCurl.value = this.curl.texture;
    m.vorticity.uniforms.dt.value = dt;
    this.pass(gl, m.vorticity, this.velocity.write, this.simTexel);
    this.velocity.swap();

    m.divergence.uniforms.uVelocity.value = this.velocity.read.texture;
    this.pass(gl, m.divergence, this.divergence, this.simTexel);

    m.clear.uniforms.uTexture.value = this.pressure.read.texture;
    m.clear.uniforms.value.value = SETTINGS.pressure;
    this.pass(gl, m.clear, this.pressure.write, this.simTexel);
    this.pressure.swap();

    m.pressure.uniforms.uDivergence.value = this.divergence.texture;
    for (let i = 0; i < SETTINGS.pressureIterations; i++) {
      m.pressure.uniforms.uPressure.value = this.pressure.read.texture;
      this.pass(gl, m.pressure, this.pressure.write, this.simTexel);
      this.pressure.swap();
    }

    m.gradient.uniforms.uPressure.value = this.pressure.read.texture;
    m.gradient.uniforms.uVelocity.value = this.velocity.read.texture;
    this.pass(gl, m.gradient, this.velocity.write, this.simTexel);
    this.velocity.swap();

    m.advection.uniforms.uVelocity.value = this.velocity.read.texture;
    m.advection.uniforms.uSource.value = this.velocity.read.texture;
    m.advection.uniforms.dt.value = dt;
    m.advection.uniforms.dissipation.value = SETTINGS.velocityDissipation;
    this.pass(gl, m.advection, this.velocity.write, this.simTexel);
    this.velocity.swap();

    m.advection.uniforms.uVelocity.value = this.velocity.read.texture;
    m.advection.uniforms.uSource.value = this.dye.read.texture;
    m.advection.uniforms.dissipation.value = SETTINGS.dyeDissipation;
    this.pass(gl, m.advection, this.dye.write, this.dyeTexel);
    this.dye.swap();
  }

  /** Draw the galaxy to the screen through the fluid and the wormhole. */
  composite(gl: THREE.WebGLRenderer, mouse: THREE.Vector2, aspect: number, radius: number, time: number) {
    const u = this.m.composite.uniforms;
    u.uScene.value = this.sceneTarget.texture;
    u.uVelocity.value = this.velocity.read.texture;
    u.uDye.value = this.dye.read.texture;
    u.uMouse.value.copy(mouse);
    u.uAspect.value = aspect;
    u.uRadius.value = radius;
    u.uTime.value = time;
    this.pass(gl, this.m.composite, null, this.simTexel);
  }

  dispose() {
    [this.velocity, this.dye, this.pressure].forEach((d) => {
      d.read.dispose();
      d.write.dispose();
    });
    this.divergence.dispose();
    this.curl.dispose();
    this.sceneTarget.dispose();
    Object.values(this.m).forEach((mat) => mat.dispose());
    this.quad.geometry.dispose();
  }
}
