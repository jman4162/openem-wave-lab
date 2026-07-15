import { useWaveLabStore, type WaveLabState } from './store';
import { decodeScene, encodeScene, type SceneSnapshot } from './urlCodec';

export const snapshotOf = (s: WaveLabState): SceneSnapshot => ({
  scene: s.scene,
  planeWave: s.planeWave,
  spreading: s.spreading,
  planarInterface: s.planarInterface,
  tau: s.tau,
  playing: s.playing,
  speed: s.speed,
  probeZeta: s.probeZeta,
  probeRho: s.probeRho,
  probeX: s.probeX,
  probeZ: s.probeZ,
  spreadingKind: s.spreadingKind,
  spreadingCompare: s.spreadingCompare,
  spreadingEnvelope: s.spreadingEnvelope,
  spreadingLogPlot: s.spreadingLogPlot,
});

/**
 * Load scene state from the current URL, then mirror store changes back into
 * the address bar (debounced replaceState, no history entries).
 */
export function initUrlSync(): void {
  const initial = decodeScene(window.location.search);
  // Accessibility: honor prefers-reduced-motion unless the link explicitly
  // encodes a play state; the user can still press Play.
  const hasExplicitPlayState = new URLSearchParams(window.location.search).has('pl');
  if (!hasExplicitPlayState && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    initial.playing = false;
  }
  useWaveLabStore.setState(initial);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastQuery = '';
  useWaveLabStore.subscribe((s) => {
    const query = encodeScene(snapshotOf(s)).toString();
    if (query === lastQuery) return;
    lastQuery = query;
    clearTimeout(timer);
    timer = setTimeout(() => {
      window.history.replaceState(null, '', `${window.location.pathname}?${query}`);
    }, 300);
  });
}
