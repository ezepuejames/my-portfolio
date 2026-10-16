// Black hole: a ray-marched Schwarzschild black hole.
//
// Every pixel inside the bounding sphere traces a light ray backwards from the
// camera through curved spacetime. Units inside the shader are Schwarzschild
// radii (rs = 1), so the horizon is r = 1, the photon sphere r = 1.5 and the
// innermost stable orbit r = 3. Rays are bent with the standard photon-orbit
// equation for the Schwarzschild metric,
//     d²x/dλ² = -1.5 · h² · x / r⁵,    h = |x × dx/dλ|
// which gives the correct deflection, Einstein ring and photon ring. Rays that
// fall inside r = 1 are captured (the shadow). Rays that escape look up the
// real rendered scene in the direction they left in, so planets, stars and the
// spacetime lattice behind the hole are lensed. Rays that cross the disk plane
// pick up thin-disk emission with relativistic Doppler beaming and
// gravitational redshift.

export const blackHoleVertex = /* glsl */ `
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const blackHoleFragment = /* glsl */ `
  precision highp float;

  uniform sampler2D uScene;      // the scene rendered without the black hole
  uniform sampler2D uDepth;      // its depth, to keep foreground objects unlensed
  uniform vec2 uResolution;      // drawing buffer size in pixels
  uniform mat4 uViewProj;        // camera projection * view
  uniform mat4 uModel;           // black hole local (rs units) to world
  uniform vec3 uCamLocal;        // camera position in local rs units
  uniform float uCamNear;
  uniform float uCamFar;
  uniform float uRadius;         // bounding sphere radius in rs
  uniform float uTime;
  uniform float uDiskIn;         // inner disk edge (ISCO = 3)
  uniform float uDiskOut;
  uniform float uFade;

  varying vec3 vLocal;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  // Approximate blackbody colour for a temperature in kelvin (1000K-40000K).
  vec3 blackbody(float t) {
    t = clamp(t, 1000.0, 40000.0) / 100.0;
    vec3 c;
    c.r = t <= 66.0 ? 1.0 : clamp(1.292936 * pow(t - 60.0, -0.1332047), 0.0, 1.0);
    c.g = t <= 66.0 ? clamp(0.3900816 * log(t) - 0.6318414, 0.0, 1.0)
                    : clamp(1.1298909 * pow(t - 60.0, -0.0755148), 0.0, 1.0);
    c.b = t >= 66.0 ? 1.0 : (t <= 19.0 ? 0.0 : clamp(0.5432068 * log(t - 10.0) - 1.1962541, 0.0, 1.0));
    return c;
  }

  float linearDepth(float d) {
    float z = d * 2.0 - 1.0;
    return (2.0 * uCamNear * uCamFar) / (uCamFar + uCamNear - z * (uCamFar - uCamNear));
  }

  void main() {
    vec2 screenUv = gl_FragCoord.xy / uResolution;
    vec3 ro = uCamLocal;
    vec3 rd = normalize(vLocal - uCamLocal);

    // Where the ray enters the bounding sphere (or 0 if the camera is inside).
    float b = dot(ro, rd);
    float c = dot(ro, ro) - uRadius * uRadius;
    float disc = b * b - c;
    if (disc < 0.0) discard;
    float tEnter = max(-b - sqrt(disc), 0.0);

    // Anything in front of the sphere is not lensed: show it as is.
    vec3 enterWorld = (uModel * vec4(ro + rd * tEnter, 1.0)).xyz;
    vec4 enterClip = uViewProj * vec4(enterWorld, 1.0);
    float enterDepth = enterClip.w;
    float sceneDepth = linearDepth(texture2D(uDepth, screenUv).r);
    if (sceneDepth < enterDepth - 0.05) {
      gl_FragColor = vec4(texture2D(uScene, screenUv).rgb, 1.0);
      return;
    }

    vec3 pos = ro + rd * tEnter;
    vec3 vel = rd;
    float h2 = dot(cross(pos, vel), cross(pos, vel));

    vec3 diskColor = vec3(0.0);
    float diskAlpha = 0.0;
    bool captured = false;

    for (int i = 0; i < 220; i++) {
      float r = length(pos);
      if (r < 1.0) { captured = true; break; }
      if (r > uRadius + 0.01 && dot(pos, vel) > 0.0) break;

      // Smaller steps near the hole, where the bending is strongest.
      float dt = clamp(0.045 * r * r / (1.0 + r), 0.015, 0.9);
      vec3 prev = pos;
      vec3 accel = -1.5 * h2 * pos / pow(r, 5.0);
      vel += accel * dt;
      pos += vel * dt;

      // Crossing the disk plane (y = 0): add its light, front to back.
      if (prev.y * pos.y < 0.0 && diskAlpha < 0.99) {
        float f = prev.y / (prev.y - pos.y);
        vec3 hit = mix(prev, pos, f);
        float rh = length(hit.xz);
        if (rh > uDiskIn && rh < uDiskOut) {
          // Thin-disk temperature profile, peaking just outside the ISCO.
          float x = uDiskIn / rh;
          float temp = 4300.0 * pow(x, 0.75) * pow(max(1.0 - sqrt(x), 0.0), 0.25) * 1.9;

          // Keplerian orbital speed seen by a static observer, and beaming.
          float beta = clamp(sqrt(0.5 / (rh - 1.0)), 0.0, 0.85);
          float gamma = inversesqrt(1.0 - beta * beta);
          vec3 orbitDir = normalize(vec3(-hit.z, 0.0, hit.x));
          vec3 toObserver = -normalize(vel);
          float doppler = 1.0 / (gamma * (1.0 - beta * dot(orbitDir, toObserver)));
          float gravShift = sqrt(1.0 - 1.0 / rh);
          float g = doppler * gravShift;

          // Turbulent structure that orbits at the local Keplerian rate.
          float angle = atan(hit.z, hit.x);
          float omega = sqrt(0.5 / (rh * rh * rh));
          float swirl = fbm(vec2(angle * 3.0 - uTime * omega * 6.0 + rh * 0.9, rh * 1.6));
          float edge = smoothstep(uDiskIn, uDiskIn + 0.6, rh) * smoothstep(uDiskOut, uDiskOut - 3.5, rh);
          float density = edge * (0.45 + 0.75 * swirl);

          vec3 emit = blackbody(temp * g) * pow(g, 4.0) * pow(x, 1.6) * 3.2;
          float a = clamp(density * 0.9, 0.0, 1.0);
          diskColor += (1.0 - diskAlpha) * emit * a;
          diskAlpha += (1.0 - diskAlpha) * a;
        }
      }
    }

    vec3 background = vec3(0.0);
    if (!captured) {
      // Direction the ray leaves in. Blend back to a straight ray near the
      // bounding sphere so the lensing has no visible edge.
      float impact = sqrt(h2);
      float edgeBlend = smoothstep(uRadius * 0.62, uRadius * 0.98, impact);
      vec3 outDir = normalize(mix(normalize(vel), rd, edgeBlend));
      vec3 worldDir = normalize(mat3(uModel) * outDir);
      vec3 worldFrom = (uModel * vec4(pos, 1.0)).xyz;
      vec4 clip = uViewProj * vec4(worldFrom + worldDir * 400.0, 1.0);
      if (clip.w > 0.0) {
        vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
        if (all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)))) {
          background = texture2D(uScene, uv).rgb;
        } else {
          // Off-screen: show a faint star pattern so the ring never looks empty.
          vec2 s = vec2(atan(worldDir.z, worldDir.x), asin(clamp(worldDir.y, -1.0, 1.0))) * 120.0;
          float star = step(0.995, hash(floor(s)));
          background = vec3(0.02, 0.03, 0.05) + star * vec3(0.8);
        }
      }
    }

    vec3 color = diskColor + (1.0 - diskAlpha) * background;
    // Gentle tone mapping so the hot inner disk does not clip harshly.
    color = 1.0 - exp(-color * 1.25);
    vec3 original = texture2D(uScene, screenUv).rgb;
    gl_FragColor = vec4(mix(original, color, uFade), 1.0);
  }
`;
