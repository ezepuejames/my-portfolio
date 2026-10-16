// GLSL for the space hero: starfield, star, planets and orbit trails.

// Shared 3D value noise + fbm, used by the star surface and planet bands.
const noise = /* glsl */ `
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0, 0, 0)), hash(i + vec3(1, 0, 0)), f.x),
          mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
          mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }
`;

// Starfield: points scattered on a large sphere that twinkle at their own rate.
export const starfieldVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSeed;
  attribute float aSize;
  varying float vTwinkle;

  void main() {
    vTwinkle = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed * 1.8) + aSeed * 40.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio;
  }
`;

export const starfieldFragment = /* glsl */ `
  uniform float uOpacity;
  varying float vTwinkle;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d) * vTwinkle * uOpacity;
    gl_FragColor = vec4(vec3(0.86, 0.9, 1.0), a);
  }
`;

// Star surface: churning granulation.
export const starVertex = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vPos = position;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const starFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uHot;
  uniform vec3 uCool;
  uniform float uFade;
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vView;
  ${noise}

  void main() {
    float n = fbm(vPos * 3.2 + vec3(0.0, uTime * 0.15, uTime * 0.08));
    float rim = pow(1.0 - max(dot(vNormal, vView), 0.0), 1.6);
    vec3 color = mix(uCool, uHot, n * 1.3);
    color += rim * uHot * 0.6;
    gl_FragColor = vec4(color, uFade);
  }
`;

// Star glow: a camera-facing quad with a soft radial falloff, added on top.
export const glowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const glowFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uFade;
  varying vec2 vUv;

  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float pulse = 1.0 + 0.05 * sin(uTime * 1.3);
    float a = pow(max(1.0 - d, 0.0), 2.4) * 0.8 * pulse * uFade;
    gl_FragColor = vec4(uColor, a);
  }
`;

// Planets: banded procedural surfaces lit by the star at the origin.
export const planetVertex = /* glsl */ `
  varying vec3 vObj;
  varying vec3 vWorld;
  varying vec3 vNormal;

  void main() {
    vObj = position;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const planetFragment = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uStarPos;
  uniform float uSeed;
  uniform float uBands;
  uniform float uFade;
  varying vec3 vObj;
  varying vec3 vWorld;
  varying vec3 vNormal;
  ${noise}

  void main() {
    vec3 p = normalize(vObj);
    float warp = fbm(p * 3.0 + uSeed) * 0.8;
    float bands = sin((p.y + warp * 0.35) * uBands + uSeed * 3.0) * 0.5 + 0.5;
    float detail = fbm(p * 7.0 + uSeed * 2.0);
    vec3 surface = mix(uColorA, uColorB, smoothstep(0.2, 0.8, bands * 0.7 + detail * 0.5));

    vec3 L = normalize(uStarPos - vWorld);
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 N = normalize(vNormal);
    float diffuse = max(dot(N, L), 0.0);
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);

    vec3 color = surface * (0.06 + diffuse * 1.1) + rim * uColorB * 0.35 * (0.3 + diffuse);
    gl_FragColor = vec4(color, uFade);
  }
`;

// Space dust: a volume of motes that wraps around the camera in all three
// axes, so flying forward or sideways never runs out. Motes grow and
// brighten as they get close, which sells the sense of moving through depth.
export const dustVertex = /* glsl */ `
  uniform vec3 uOffset;   // travel and pan, in world units
  uniform vec3 uTile;     // size of the repeating volume
  uniform float uNear;    // how far behind the camera motes go before wrapping
  uniform float uPixelRatio;
  attribute float aSeed;
  varying float vAlpha;

  vec3 wrapVolume(vec3 p) {
    vec3 shifted = p + uOffset;
    vec3 lo = vec3(-uTile.x * 0.5, -uTile.y * 0.5, uNear - uTile.z);
    return lo + mod(shifted - lo, uTile);
  }

  void main() {
    vec3 p = wrapVolume(position);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float depth = -mv.z;
    float far = uTile.z - uNear;
    vAlpha = smoothstep(far, far * 0.55, depth) * smoothstep(0.2, 3.0, depth) * (0.35 + aSeed * 0.65);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.0 + aSeed * 1.6) * uPixelRatio * clamp(18.0 / depth, 0.6, 5.0);
  }
`;

export const dustFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vec3(0.82, 0.88, 1.0), smoothstep(0.5, 0.0, d) * vAlpha);
  }
`;

// Spacetime lattice: lines running along x, y and z through the whole volume,
// wrapping forever with it. Every star and planet bends nearby lines toward
// itself, so the grid visibly curves around each body; heavier bodies bend it
// more. Moving fast sends a ripple through it and makes it glow brighter.
export const MASS_SLOTS = 32;

export const gridVertex = /* glsl */ `
  #define MASSES ${MASS_SLOTS}
  uniform vec3 uOffset;   // travel and pan
  uniform vec3 uTile;
  uniform float uNear;
  uniform vec3 uMassPos[MASSES];
  uniform float uMass[MASSES];
  uniform float uTime;
  uniform float uSpeed;   // 0 at rest, 1 when moving fast
  uniform vec3 uHole;     // black hole position
  uniform float uHoleMass;
  uniform float uWaveAge[3]; // seconds since each of the last three bursts (<0 = none)
  uniform vec4 uWave;     // speed, width, amplitude, unused
  attribute vec3 aMid;    // midpoint of this line segment
  varying float vAlpha;
  varying float vBend;
  varying float vWave;

  void main() {
    // Wrap the whole segment by its midpoint so lines never stretch across the volume.
    vec3 lo = vec3(-uTile.x * 0.5, -uTile.y * 0.5, uNear - uTile.z);
    vec3 m = aMid + uOffset;
    vec3 wrapped = lo + mod(m - lo, uTile);
    vec3 p = position + (wrapped - aMid);

    // Curve the lattice toward each mass. The pull is capped so lines bend
    // around a body instead of collapsing into it.
    vec3 bend = vec3(0.0);
    for (int i = 0; i < MASSES; i++) {
      vec3 d = uMassPos[i] - p;
      float r = length(d) + 1e-4;
      float pull = uMass[i] / (1.0 + r * r * 0.35);
      bend += (d / r) * min(pull, r * 0.6);
    }
    // The black hole bends the lattice hardest of all.
    {
      vec3 d = uHole - p;
      float r = length(d) + 1e-4;
      float pull = uHoleMass / (1.0 + r * r * 0.12);
      bend += (d / r) * min(pull, r * 0.75);
    }
    p += bend;

    // Gravitational waves: rings expanding from the black hole at a fixed
    // speed. Like real waves they are transverse and quadrupolar: space is
    // stretched along one direction across the wavefront and squeezed along
    // the other, alternating as the wave passes.
    vWave = 0.0;
    vec3 fromHole = p - uHole;
    float rh = length(fromHole) + 1e-4;
    vec3 n = fromHole / rh;
    vec3 e1 = normalize(cross(n, abs(n.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
    vec3 e2 = cross(n, e1);
    for (int k = 0; k < 3; k++) {
      float age = uWaveAge[k];
      if (age < 0.0) continue;
      float front = age * uWave.x;
      float shell = (rh - front) / uWave.y;
      float envelope = exp(-shell * shell) * uWave.z / (1.0 + rh * 0.04) * smoothstep(0.0, 0.6, age);
      float phase = sin(shell * 3.1416 * 1.5);
      p += (e1 * dot(fromHole, e1) - e2 * dot(fromHole, e2)) / rh * envelope * phase * 2.2;
      vWave += envelope;
    }

    // A ripple runs along the direction of travel while moving.
    p += vec3(0.0, sin(p.z * 0.5 + uTime * 6.0), 0.0) * 0.18 * uSpeed;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float depth = -mv.z;
    float far = uTile.z - uNear;
    vBend = clamp(length(bend) * 0.9, 0.0, 1.0);
    vAlpha = smoothstep(far, far * 0.4, depth)
           * smoothstep(1.0, 6.0, depth)
           * (0.07 + 0.12 * uSpeed + vBend * 0.45 + vWave * 0.9);
    gl_Position = projectionMatrix * mv;
  }
`;

export const gridFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uBendColor;
  varying float vAlpha;
  varying float vBend;
  varying float vWave;
  void main() {
    vec3 c = mix(uColor, uBendColor, vBend);
    c = mix(c, vec3(0.75, 0.9, 1.0), clamp(vWave * 1.5, 0.0, 1.0));
    gl_FragColor = vec4(c, vAlpha);
  }
`;
