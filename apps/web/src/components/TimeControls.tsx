import { useEffect, useRef } from 'react';
import { useWaveLabStore } from '../state/store';

const SPEEDS = [0.1, 0.25, 0.5, 1];

export function TimeControls() {
  const playing = useWaveLabStore((s) => s.playing);
  const speed = useWaveLabStore((s) => s.speed);
  const setPlaying = useWaveLabStore((s) => s.setPlaying);
  const setSpeed = useWaveLabStore((s) => s.setSpeed);
  const setTau = useWaveLabStore((s) => s.setTau);
  const stepPhaseDeg = useWaveLabStore((s) => s.stepPhaseDeg);

  const sliderRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  // Transient subscription: the scrubber follows tau at frame rate without
  // re-rendering this component (see docs/architecture.md).
  useEffect(
    () =>
      useWaveLabStore.subscribe((s) => {
        const wrapped = ((s.tau % 2) + 2) % 2;
        if (sliderRef.current) sliderRef.current.value = wrapped.toFixed(3);
        if (labelRef.current) labelRef.current.textContent = `t/T = ${wrapped.toFixed(2)}`;
      }),
    [],
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 16px',
        borderTop: '1px solid #ddd',
        fontSize: 14,
      }}
    >
      <button onClick={() => setPlaying(!playing)} style={{ width: 64 }}>
        {playing ? 'Pause' : 'Play'}
      </button>
      <button onClick={() => stepPhaseDeg(-90)}>−90°</button>
      <button onClick={() => stepPhaseDeg(-15)}>−15°</button>
      <button onClick={() => stepPhaseDeg(15)}>+15°</button>
      <button onClick={() => stepPhaseDeg(90)}>+90°</button>
      <input
        ref={sliderRef}
        type="range"
        min={0}
        max={2}
        step={0.005}
        defaultValue={0}
        style={{ flex: 1 }}
        onInput={(e) => {
          setPlaying(false);
          setTau(parseFloat(e.currentTarget.value));
        }}
        aria-label="Scrub time over two periods"
      />
      <span ref={labelRef} style={{ fontFamily: 'monospace', minWidth: 90 }}>
        t/T = 0.00
      </span>
      <label>
        speed{' '}
        <select value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))}>
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s} T/s
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
