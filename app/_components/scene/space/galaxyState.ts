// Shared state for the galaxy hero. DOM handlers write to it, the Three.js
// scene reads and updates it every frame, so dragging never re-renders React.
export const galaxy = {
  // Pan offset in world units: target follows the drag, current eases toward it.
  targetX: 0,
  targetY: 0,
  x: 0,
  y: 0,
  vx: 0, // release velocity for inertia
  vy: 0,
  dragging: false,
  hovered: -1, // project index under the cursor
  nearest: -1, // project closest to the centre of the screen
  focused: -1, // project the camera has flown to, -1 when none
  unitsPerPixel: 0.01, // updated by the scene to match the camera
  onNearest: null as ((index: number) => void) | null,
  onHover: null as ((index: number) => void) | null,
  onSelect: null as ((index: number) => void) | null,
};
