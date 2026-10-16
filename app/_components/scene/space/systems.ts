// Each project is a small star system: a star with one planet in orbit.
// Values are in scene units; order matches `work` in app/content.ts.

export type SystemLook = {
  size: number; // planet radius
  a: string; // planet base colour
  b: string; // planet band colour
  bands: number; // stripe count in the surface shader
  ring?: boolean;
  moons: number; // 0 to 2
  orbit: number; // planet's orbit radius around its star
  tilt: number; // axial tilt in radians (Earth is about 0.41)
  incline: number; // orbit inclination in radians
  star: { hot: string; cool: string; size: number };
};

const SUN = { hot: "#fff3dc", cool: "#f2a65a", size: 0.32 };
const BLUE = { hot: "#f1f6ff", cool: "#7fa7ff", size: 0.28 };
const RED = { hot: "#ffe4d6", cool: "#e0603e", size: 0.24 };

export const SYSTEMS: SystemLook[] = [
  { size: 0.85, a: "#1d3fae", b: "#9cc2ff", bands: 7, ring: true, moons: 2, orbit: 3.1, tilt: 0.47, incline: 0.35, star: SUN }, // AGM platform
  { size: 0.72, a: "#7a3b16", b: "#f2b26b", bands: 11, moons: 1, orbit: 2.8, tilt: 0.2, incline: -0.25, star: RED }, // The Energy Vanguard
  { size: 0.62, a: "#2a5f3a", b: "#bfe6b0", bands: 5, moons: 1, orbit: 2.5, tilt: 0.41, incline: 0.45, star: SUN }, // Brillianda
  { size: 0.58, a: "#3b2a6b", b: "#c7b8ff", bands: 9, moons: 0, orbit: 2.3, tilt: 0.1, incline: -0.4, star: BLUE }, // RouteLink MFB
  { size: 0.56, a: "#0f5a66", b: "#9ff0f0", bands: 6, moons: 1, orbit: 2.4, tilt: 0.52, incline: 0.2, star: BLUE }, // RoutePay
  { size: 0.5, a: "#6b6f78", b: "#e3ddd2", bands: 4, moons: 0, orbit: 2.0, tilt: 0.05, incline: -0.3, star: SUN }, // Crafwell
  { size: 0.55, a: "#5a1e2f", b: "#ff9fb0", bands: 13, ring: true, moons: 0, orbit: 2.6, tilt: 0.9, incline: 0.5, star: RED }, // DeFi Shield
  { size: 0.42, a: "#4a4f22", b: "#e8e39a", bands: 8, moons: 1, orbit: 1.8, tilt: 0.3, incline: -0.15, star: SUN }, // Lead Radar
  { size: 0.46, a: "#7a2d14", b: "#ffc49c", bands: 10, moons: 0, orbit: 2.0, tilt: 0.38, incline: 0.3, star: RED }, // YouMeHungry
  { size: 0.42, a: "#2b3a55", b: "#c8d6ee", bands: 5, moons: 1, orbit: 1.9, tilt: 0.15, incline: -0.45, star: BLUE }, // Global Harvest
  { size: 0.42, a: "#6b2a5c", b: "#f6b8e4", bands: 7, moons: 0, orbit: 1.8, tilt: 0.6, incline: 0.25, star: SUN }, // HerRising
];

/** Each star's gravity. Orbital speed follows Kepler: slower when the orbit is wider. */
export const STAR_GM = 2.2;

/** The repeating volume the systems live in, and how it wraps around the camera. */
export const VOLUME = { x: 36, y: 22, z: 84 };
export const NEAR = 8; // systems pass this far behind the camera before wrapping to the back

/**
 * The black hole. `rs` is its Schwarzschild radius in scene units; the shader
 * works in multiples of it. Light is bent inside `lensRadius` (in rs), and the
 * accretion disk runs from the innermost stable orbit (3 rs) to `diskOuter`.
 */
export const BLACK_HOLE = {
  // Starts out of sight ahead and to the right; scrolling brings it into view.
  position: [9, 2, -16] as [number, number, number],
  rs: 0.7,
  lensRadius: 14,
  diskOuter: 13,
  gm: 4, // how hard it bends the spacetime lattice
};

/** Gravitational-wave bursts from the black hole ripple through the lattice. */
export const WAVES = { every: 6.5, speed: 16, width: 2.6, amplitude: 0.55 };
