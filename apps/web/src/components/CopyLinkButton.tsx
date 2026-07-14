import { useState } from 'react';
import { useWaveLabStore } from '../state/store';
import { encodeScene } from '../state/urlCodec';
import { snapshotOf } from '../state/urlSync';

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    // Build the URL from the store directly so the copied link never lags
    // behind the debounced address-bar sync.
    const query = encodeScene(snapshotOf(useWaveLabStore.getState())).toString();
    const url = `${window.location.origin}${window.location.pathname}?${query}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return <button onClick={copy}>{copied ? 'Copied!' : 'Copy link'}</button>;
}
