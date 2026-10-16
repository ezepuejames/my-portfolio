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

// Spacetime grid: a sheet of lines below the galaxy that wraps forever and
// is pulled down into a gravity well under every star, like the classic
// rubber-sheet picture of curved spacetime. Moving fast sends ripples
// along it and makes it glow brighter.
export const STAR_SLOTS = 16;

export const gridVertex = /* glsl */ `
  #define STARS ${STAR_SLOTS}
  uniform vec3 uOffset;   // travel and pan
  uniform vec3 uTile;
  uniform float uNear;
  uniform float uY;       // height of the sheet
  uniform vec3 uStars[STARS];
  uniform float uMass[STARS];
  uniform float uTime;
  uniform float uSpeed;   // 0 at rest, 1 when moving fast
  attribute vec3 aMid;    // midpoint of this line segment
  varying float vAlpha;
  varying float vWell;

  void main() {
    // Wrap the whole segment by its midpoint so lines never stretch across the volume.
    vec2 lo = vec2(-uTile.x * 0.5, uNear - uTile.z);
    vec2 m = aMid.xz + uOffset.xz;
    vec2 wrapped = lo + mod(m - lo, uTile.xz);
    vec3 p = position;
    p.xz += wrapped - aMid.xz;
    p.y = uY;

    // Each star sinks the sheet into a well directly beneath it, deeper for
    // heavier stars, and draws the grid lines in toward its centre.
    float sink = 0.0;
    vec2 draw = vec2(0.0);
    for (int i = 0; i < STARS; i++) {
      vec2 d = uStars[i].xz - p.xz;
      float r2 = dot(d, d);
      float well = uMass[i] / (1.0 + r2 * 0.22);
      sink += well;
      draw += d * well * 0.06;
    }
    sink = min(sink, 5.5);
    p.y -= sink;
    p.xz += draw;
    vec3 pull = vec3(draw.x, -sink, draw.y);

    // Ripples travel through the sheet while you move.
    p.y += sin(p.z * 0.55 + uTime * 5.0) * 0.22 * uSpeed;
    p.y += sin(p.x * 0.4 - uTime * 3.0) * 0.08 * uSpeed;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float depth = -mv.z;
    float far = uTile.z - uNear;
    vWell = clamp(sink * 0.3, 0.0, 1.0);
    vAlpha = smoothstep(far, far * 0.35, depth) * smoothstep(0.5, 4.0, depth) * (0.24 + 0.36 * uSpeed + vWell * 0.35);
    gl_Position = projectionMatrix * mv;
  }
`;

export const gridFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uWellColor;
  varying float vAlpha;
  varying float vWell;
  void main() {
    gl_FragColor = vec4(mix(uColor, uWellColor, vWell), vAlpha);
  }
`;
