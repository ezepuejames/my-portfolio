// Shared mutable state written by GSAP and DOM listeners (outside React)
// and read every frame by the Three.js scenes, so motion never re-renders.
export const sceneState = {
  scroll: 0, // 0 at top of hero, 1 once the hero has scrolled away
  intro: 0, // 0 to 1, animated by the GSAP intro timeline
  pointerActive: false, // true while the mouse is over the hero
};
