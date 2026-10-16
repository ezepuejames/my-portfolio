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

// Warp streaks: each mote is a line from its position back along the direction
// of travel. Length and brightness follow speed, so at rest they vanish and
// a fast scroll or drag turns the dust into hyperspace lines.
export const streakVertex = /* glsl */ `
  uniform vec3 uOffset;
  uniform vec3 uTile;
  uniform float uNear;
  uniform vec3 uVel;      // view velocity, units per second
  uniform float uStretch; // seconds of motion each streak shows
  attribute float aSeed;
  attribute float aTail;  // 0 at the head of the streak, 1 at the tail
  varying float vAlpha;

  vec3 wrapVolume(vec3 p) {
    vec3 shifted = p + uOffset;
    vec3 lo = vec3(-uTile.x * 0.5, -uTile.y * 0.5, uNear - uTile.z);
    return lo + mod(shifted - lo, uTile);
  }

  void main() {
    // Wrap the head only, then hang the tail off it, so a streak never
    // stretches across the whole volume when it wraps.
    vec3 head = wrapVolume(position);
    vec3 p = head - uVel * uStretch * (0.6 + aSeed * 0.8) * aTail;

    vec4 mvHead = modelViewMatrix * vec4(head, 1.0);
    float depth = -mvHead.z;
    float far = uTile.z - uNear;
    float speed = length(uVel);
    vAlpha = smoothstep(2.0, 10.0, speed)
           * smoothstep(far, far * 0.45, depth)
           * smoothstep(0.3, 2.0, depth)
           * mix(1.0, 0.0, aTail)
           * (0.55 + aSeed * 0.45);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

export const streakFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(vec3(0.78, 0.86, 1.0), vAlpha);
  }
`;
