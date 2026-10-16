// GPU fluid simulation (stable fluids: advect, add vorticity, project to keep
// it incompressible), plus the final pass that bends the galaxy with it.
// The simulation steps follow Jos Stam's "Stable Fluids" as popularised by
// Pavel Dobryakov's WebGL fluid demo (MIT).

export const baseVertex = /* glsl */ `
  precision highp float;
  uniform vec2 texelSize;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  void main () {
    vUv = position.xy * 0.5 + 0.5;
    vL = vUv - vec2(texelSize.x, 0.0);
    vR = vUv + vec2(texelSize.x, 0.0);
    vT = vUv + vec2(0.0, texelSize.y);
    vB = vUv - vec2(0.0, texelSize.y);
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const clearShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform float value;
  void main () { gl_FragColor = value * texture2D(uTexture, vUv); }
`;

export const splatShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTarget;
  uniform float aspectRatio;
  uniform vec3 color;
  uniform vec2 point;
  uniform float radius;
  void main () {
    vec2 p = vUv - point.xy;
    p.x *= aspectRatio;
    vec3 splat = exp(-dot(p, p) / radius) * color;
    vec3 base = texture2D(uTarget, vUv).xyz;
    gl_FragColor = vec4(base + splat, 1.0);
  }
`;

export const advectionShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uVelocity;
  uniform sampler2D uSource;
  uniform vec2 texelSize;
  uniform float dt;
  uniform float dissipation;
  void main () {
    vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
    vec4 result = texture2D(uSource, coord);
    float decay = 1.0 + dissipation * dt;
    gl_FragColor = result / decay;
  }
`;

export const divergenceShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uVelocity;
  void main () {
    float L = texture2D(uVelocity, vL).x;
    float R = texture2D(uVelocity, vR).x;
    float T = texture2D(uVelocity, vT).y;
    float B = texture2D(uVelocity, vB).y;
    vec2 C = texture2D(uVelocity, vUv).xy;
    if (vL.x < 0.0) { L = -C.x; }
    if (vR.x > 1.0) { R = -C.x; }
    if (vT.y > 1.0) { T = -C.y; }
    if (vB.y < 0.0) { B = -C.y; }
    float div = 0.5 * (R - L + T - B);
    gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
  }
`;

export const curlShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uVelocity;
  void main () {
    float L = texture2D(uVelocity, vL).y;
    float R = texture2D(uVelocity, vR).y;
    float T = texture2D(uVelocity, vT).x;
    float B = texture2D(uVelocity, vB).x;
    float vorticity = R - L - T + B;
    gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
  }
`;

export const vorticityShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uVelocity;
  uniform sampler2D uCurl;
  uniform float curl;
  uniform float dt;
  void main () {
    float L = texture2D(uCurl, vL).x;
    float R = texture2D(uCurl, vR).x;
    float T = texture2D(uCurl, vT).x;
    float B = texture2D(uCurl, vB).x;
    float C = texture2D(uCurl, vUv).x;
    vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
    force /= length(force) + 0.0001;
    force *= curl * C;
    force.y *= -1.0;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity += force * dt;
    velocity = min(max(velocity, -1000.0), 1000.0);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

export const pressureShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uPressure;
  uniform sampler2D uDivergence;
  void main () {
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    float divergence = texture2D(uDivergence, vUv).x;
    float pressure = (L + R + B + T - divergence) * 0.25;
    gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
  }
`;

export const gradientSubtractShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uPressure;
  uniform sampler2D uVelocity;
  void main () {
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity.xy -= vec2(R - L, T - B);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

// Final pass: the galaxy, bent by the fluid and opened up by a wormhole at the cursor.
export const compositeShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uScene;
  uniform sampler2D uVelocity;
  uniform sampler2D uDye;
  uniform vec2 uMouse;      // cursor in 0..1 screen space
  uniform float uAspect;    // width / height
  uniform float uRadius;    // wormhole mouth radius in screen heights
  uniform float uTime;

  const float PI = 3.14159265;

  vec2 rotate(vec2 v, float a) {
    float c = cos(a); float s = sin(a);
    return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
  }

  void main () {
    // 1. The fluid trail: shift each pixel along the local flow.
    vec2 vel = texture2D(uVelocity, vUv).xy;
    float energy = texture2D(uDye, vUv).r;
    vec2 flow = vel * 0.00016;
    float flowLen = length(flow);
    if (flowLen > 0.03) flow *= 0.03 / flowLen; // never tear the image apart
    vec2 uv = vUv - flow;

    // 2. The wormhole mouth, worked out in aspect-correct space.
    vec2 d = (uv - uMouse) * vec2(uAspect, 1.0);
    float r = length(d);
    float R = max(uRadius, 1e-4);

    vec3 color;
    if (r < R) {
      // Inside: a view down the throat. The galaxy is folded into the sphere,
      // twisting harder toward the centre, with rings sliding inward so it
      // reads as depth rather than a flat picture.
      float x = r / R;
      float depth = -log(max(x, 0.002));
      float twist = depth * 0.9 + uTime * 0.35;
      vec2 dir = rotate(d / max(r, 1e-5), twist);
      float fold = pow(x, 0.55);
      vec2 other = uMouse + dir * vec2(1.0 / uAspect, 1.0) * fold * 0.48 + vec2(0.13, -0.07);
      other = abs(mod(other, 2.0) - 1.0); // mirror at edges so it never runs out
      vec3 throat = texture2D(uScene, other).rgb;
      float rings = 0.82 + 0.18 * sin(depth * 9.0 - uTime * 3.2);
      float darken = smoothstep(0.0, 0.85, x);
      color = throat * rings * mix(0.45, 1.15, darken);
      color += vec3(0.55, 0.65, 1.0) * pow(1.0 - x, 6.0) * 0.12; // faint far-side glow
    } else {
      // Outside: light bends around the mouth like a lens, strongest at the rim.
      float bend = (R * R) / (r * r) * 0.85;
      vec2 lensed = uMouse + (d * (1.0 + bend * 1.6)) * vec2(1.0 / uAspect, 1.0);
      lensed = mix(uv, lensed, smoothstep(R * 4.0, R, r));
      // Chromatic split where the fluid is moving fast.
      float split = clamp(length(vel) * 0.00002, 0.0, 0.006);
      color.r = texture2D(uScene, lensed + vec2(split, 0.0)).r;
      color.g = texture2D(uScene, lensed).g;
      color.b = texture2D(uScene, lensed - vec2(split, 0.0)).b;
    }

    // A thin bright ring at the edge of the mouth, like an Einstein ring.
    float rim = exp(-pow((r - R) / (R * 0.06 + 0.001), 2.0));
    color += vec3(0.7, 0.8, 1.0) * rim * 0.55 * smoothstep(0.0, 0.02, R);

    // A faint sheen on the swirling trail itself.
    color += vec3(0.45, 0.55, 1.0) * clamp(energy, 0.0, 1.0) * 0.06;

    gl_FragColor = vec4(color, 1.0);
  }
`;
