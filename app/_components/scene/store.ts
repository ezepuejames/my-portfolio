// Shared mutable state written by GSAP (outside React) and read every frame
// by the Three.js scene, so scroll-driven motion never triggers re-renders.
export const sceneState = {
  scroll: 0, // 0 at top of hero, 1 once the hero has scrolled away
  intro: 0, // 0 to 1, animated by the GSAP intro timeline
};
