/**
 * Quality tier for grid resolutions, read once at scene construction
 * (SceneView remounts per module, so a rotation mid-session keeps the tier
 * until the next module switch - acceptable and documented).
 */
export const smallViewport = (): boolean => Math.min(window.innerWidth, window.innerHeight) < 700;
