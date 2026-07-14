import { useWaveLabStore } from './store';
import { decodeScene, encodeScene } from './urlCodec';

/**
 * Load scene state from the current URL, then mirror store changes back into
 * the address bar (debounced replaceState, no history entries).
 */
export function initUrlSync(): void {
  const initial = decodeScene(window.location.search);
  useWaveLabStore.setState(initial);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastQuery = '';
  useWaveLabStore.subscribe((s) => {
    const query = encodeScene({
      params: s.params,
      tau: s.tau,
      playing: s.playing,
      speed: s.speed,
      probeZeta: s.probeZeta,
    }).toString();
    if (query === lastQuery) return;
    lastQuery = query;
    clearTimeout(timer);
    timer = setTimeout(() => {
      window.history.replaceState(null, '', `${window.location.pathname}?${query}`);
    }, 300);
  });
}
