import { useState } from 'react';
import { useWaveLabStore } from '../state/store';
import { encodeScene } from '../state/urlCodec';

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    // Build the URL from the store directly so the copied link never lags
    // behind the debounced address-bar sync.
    const s = useWaveLabStore.getState();
    const query = encodeScene({
      params: s.params,
      tau: s.tau,
      playing: s.playing,
      speed: s.speed,
      probeZeta: s.probeZeta,
    }).toString();
    const url = `${window.location.origin}${window.location.pathname}?${query}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return <button onClick={copy}>{copied ? 'Copied!' : 'Copy link'}</button>;
}
