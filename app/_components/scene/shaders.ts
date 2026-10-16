// Fresnel shell used by the placeholder shown in empty model slots.
export const placeholderVertex = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vec3 p = position + normal * sin(position.y * 3.0 + uTime) * 0.04;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const placeholderFragment = /* glsl */ `
  uniform vec3 uInk;
  uniform vec3 uSignal;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    float fresnel = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.2);
    vec3 color = mix(uInk, uSignal, fresnel);
    gl_FragColor = vec4(color, 0.08 + fresnel * 0.8);
  }
`;

// Grain cursor: a stippled disc of dots that sits on the gravity lens.
// Dots drift slightly in place, lag behind the direction of travel and
// spread out over links and buttons.
export const cursorVertex = /* glsl */ `
  uniform float uTime;
  uniform vec2 uVel;
  uniform float uHover;
  uniform float uSize;
  uniform float uRadius;
  uniform float uPixelRatio;
  attribute float aSeed;
  varying float vAlpha;

  void main() {
    vec2 p = position.xy * (1.0 + uHover * 0.2);

    // Gentle drift so the grain feels alive but stays even.
    float t = uTime * 0.8 + aSeed * 6.2831;
    p += vec2(sin(t), cos(t * 1.3)) * 0.9;

    // Trail: outer dots lag behind more than the core.
    float r = length(position.xy) / uRadius;
    p -= uVel * r * 0.6;

    // Fade toward the rim so the disc has a soft edge.
    vAlpha = 1.0 - smoothstep(0.85, 1.0, r);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
    gl_PointSize = uSize * uPixelRatio;
  }
`;

export const cursorFragment = /* glsl */ `
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vec3(1.0), smoothstep(0.5, 0.25, d) * vAlpha);
  }
`;
