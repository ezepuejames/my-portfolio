// GPU fluid simulation (stable fluids) that drives the cursor effect, plus the
// final composite that runs the galaxy image through it.
//
// The solver follows the classic approach used in Pavel Dobryakov's MIT-licensed
// WebGL Fluid Simulation: splat velocity where the mouse moves, add vorticity
// so it curls into swirls, then make it incompressible (divergence, pressure
// solve, gradient subtraction) and carry it along with itself (advection).

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

export const splatFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTarget;
  uniform float aspectRatio;
  uniform vec3 color;
  uniform vec2 point;
  uniform float radius;
  void main () {
    vec2 p = vUv - point;
    p.x *= aspectRatio;
    vec3 splat = exp(-dot(p, p) / radius) * color;
    gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + splat, 1.0);
  }
`;

export const curlFragment = /* glsl */ `
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
    gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
  }
`;

export const vorticityFragment = /* glsl */ `
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
    vec2 velocity = texture2D(uVelocity, vUv).xy + force * dt;
    velocity = clamp(velocity, -1000.0, 1000.0);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

export const divergenceFragment = /* glsl */ `
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
    gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
  }
`;

export const clearFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform float value;
  void main () {
    gl_FragColor = value * texture2D(uTexture, vUv);
  }
`;

export const pressureFragment = /* glsl */ `
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
    gl_FragColor = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0);
  }
`;

export const gradientSubtractFragment = /* glsl */ `
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

export const advectionFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uVelocity;
  uniform sampler2D uSource;
  uniform vec2 texelSize;
  uniform float dt;
  uniform float dissipation;
  void main () {
    vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
    gl_FragColor = texture2D(uSource, coord) / (1.0 + dissipation * dt);
  }
`;

// Final pass: the galaxy, carried through the fluid, with a wormhole at the cursor.
export const compositeFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tScene;
  uniform sampler2D tFluid;
  uniform vec2 uMouse;        // cursor in 0..1 screen space
  uniform float uAspect;      // width / height
  uniform float uRadius;      // wormhole radius, in screen heights
  uniform float uOpen;        // 0 hidden, 1 fully open
  uniform float uTime;
  uniform float uSpin;        // signed swirl from recent mouse motion

  vec3 sampleScene(vec2 uv) {
    return texture2D(tScene, clamp(uv, 0.0, 1.0)).rgb;
  }

  void main() {
    // 1. The fluid: everything is pushed along the swirling flow, with the
    //    colour channels pulled slightly apart where it moves fastest.
    vec2 flow = texture2D(tFluid, vUv).xy;
    vec2 uv = vUv - flow * 0.00016;
    vec2 split = flow * 0.00045;

    // 2. The wormhole, measured in screen heights so it stays round.
    vec2 d = (vUv - uMouse) * vec2(uAspect, 1.0);
    float r = length(d);
    float R = max(uRadius, 1e-4);
    float a = atan(d.y, d.x);

    vec3 color;
    if (uOpen > 0.001 && r < R * 2.6) {
      // Outside the mouth: space is pulled in toward the throat and twisted,
      // like light bending around a gravity well.
      float outer = smoothstep(R * 2.6, R, r);
      float pull = outer * outer * 0.55 * uOpen;
      float twist = outer * outer * (0.9 + uSpin) * uOpen;
      float ca = cos(twist), sa = sin(twist);
      vec2 dd = mat2(ca, -sa, sa, ca) * d * (1.0 - pull * (R / max(r, R)));
      vec2 lensUv = uMouse + dd / vec2(uAspect, 1.0) - flow * 0.00016;

      vec3 lensed = vec3(
        sampleScene(lensUv + split * 1.6).r,
        sampleScene(lensUv).g,
        sampleScene(lensUv - split * 1.6).b
      );

      // Inside the mouth: a tunnel. Angle wraps around the walls and 1/r runs
      // down the throat, so the galaxy image streams toward you in depth.
      float depth = 0.32 * R / max(r, 1e-4);
      vec2 tunnelUv = vec2(
        fract(a / 6.28318 + uTime * 0.03 + depth * 0.15 * uSpin),
        fract(depth - uTime * 0.35)
      );
      vec3 walls = sampleScene(tunnelUv * vec2(1.0, 0.5) + vec2(0.0, 0.25));
      // Ribs give the tunnel its 3D read; the far end fades to black.
      float ribs = 0.65 + 0.35 * sin(depth * 18.0 - uTime * 6.0);
      float far = smoothstep(4.5, 1.0, depth);
      vec3 tunnel = walls * ribs * far * vec3(1.3, 1.45, 1.9) + vec3(0.02, 0.03, 0.06) * (1.0 - far);

      // The mouth's rim glows like an Einstein ring, brightest on the edge.
      float rim = exp(-pow((r - R) / (R * 0.09), 2.0));
      vec3 ring = vec3(0.75, 0.85, 1.0) * rim * 0.9 + vec3(rim * 0.4, rim * 0.05, rim * 0.6) * abs(sin(a * 3.0 + uTime));

      float inside = smoothstep(R * 1.02, R * 0.94, r);
      color = mix(lensed, tunnel, inside * uOpen) + ring * uOpen;
    } else {
      color = vec3(
        sampleScene(uv + split).r,
        sampleScene(uv).g,
        sampleScene(uv - split).b
      );
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;
