// Shared state for the galaxy. DOM handlers write to it, the Three.js scene
// reads and updates it every frame, so navigating never re-renders React.
export const galaxy = {
  // Travel through depth (wheel, swipe, keys). Target follows input; current eases.
  targetTravel: 0,
  travel: 0,
  // Sideways pan (drag).
  targetPanX: 0,
  targetPanY: 0,
  panX: 0,
  panY: 0,
  // Velocities left over after input stops, for inertia.
  travelVel: 0,
  panVX: 0,
  panVY: 0,
  dragging: false,
  pointerActive: false,
  hovered: -1, // project index under the cursor
  nearest: -1, // project most centred in view
  focused: -1, // project the camera has flown to, -1 when none
  unitsPerPixel: 0.02, // for 1:1 dragging at mid depth, set by the scene
  intro: 0, // 0 to 1, animated by GSAP on load
  drift: 1, // idle forward drift; 0 for people who prefer reduced motion
  onNearest: null as ((index: number) => void) | null,
  onHover: null as ((index: number) => void) | null,
  onSelect: null as ((index: number) => void) | null,
};
