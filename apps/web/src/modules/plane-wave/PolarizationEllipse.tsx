import { useEffect, useRef } from 'react';
import { derivePlaneWave, fieldsAt } from '@openem/physics-core';
import { useWaveLabStore } from '../../state/store';

const SIZE = 220;
const HALF = SIZE / 2;
/** Plot radius for the z=0 field amplitude; deeper probes shrink with e^{-alpha z}. */
const R = HALF - 24;

/** Physical x is drawn up, physical y to the right, matching the 3D view. */
const toSvg = (ex: number, ey: number, scale: number): [number, number] => [
  HALF + ey * scale,
  HALF - ex * scale,
];

export function PolarizationEllipse() {
  const params = useWaveLabStore((s) => s.planeWave);
  const probeZeta = useWaveLabStore((s) => s.probeZeta);
  const dotRef = useRef<SVGCircleElement>(null);

  const derived = derivePlaneWave(params);
  const probeZ = probeZeta * derived.wavelengthM;
  const amp0 = Math.hypot(params.E0x, params.E0y);
  const scale = amp0 > 0 ? R / amp0 : 0;

  // E-tip locus over one period from the phasor at the probe.
  const points: string[] = [];
  for (let n = 0; n <= 64; n++) {
    const f = fieldsAt(params, derived, probeZ, (n / 64) * derived.periodS);
    const [x, y] = toSvg(f.E.x, f.E.y, scale);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  // The live dot follows simulation time per frame via a rAF loop that writes
  // SVG attributes directly - no React re-render (see docs/architecture.md).
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const s = useWaveLabStore.getState();
      const d = derivePlaneWave(s.planeWave);
      const z = s.probeZeta * d.wavelengthM;
      const f = fieldsAt(s.planeWave, d, z, s.tau * d.periodS);
      const a0 = Math.hypot(s.planeWave.E0x, s.planeWave.E0y);
      const [x, y] = toSvg(f.E.x, f.E.y, a0 > 0 ? R / a0 : 0);
      dotRef.current?.setAttribute('cx', x.toFixed(1));
      dotRef.current?.setAttribute('cy', y.toFixed(1));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const pol = derived.polarization;
  const handedLabel =
    pol.type === 'linear'
      ? 'linear'
      : `${pol.handedness === 'RH' ? 'right' : 'left'}-hand ${pol.type} (IEEE)`;

  return (
    <section style={{ fontSize: 12 }}>
      <h3 style={{ margin: '8px 0 2px', fontSize: 13 }}>Polarization at probe</h3>
      <svg
        width={SIZE}
        height={SIZE}
        role="img"
        aria-label={`Electric-field tip locus: ${handedLabel}`}
        style={{ background: '#181818', borderRadius: 4 }}
      >
        <line x1={HALF} y1={8} x2={HALF} y2={SIZE - 8} stroke="#333" />
        <line x1={8} y1={HALF} x2={SIZE - 8} y2={HALF} stroke="#333" />
        <text x={HALF + 4} y={16} fill="#777" fontSize={10}>
          x
        </text>
        <text x={SIZE - 16} y={HALF - 6} fill="#777" fontSize={10}>
          y
        </text>
        <polyline points={points.join(' ')} fill="none" stroke="#e11d48" strokeWidth={1.5} />
        <circle ref={dotRef} r={5} fill="#fff" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{handedLabel}</span>
        <span style={{ fontFamily: 'monospace' }}>
          AR {Number.isFinite(pol.axialRatio) ? pol.axialRatio.toFixed(2) : '∞'} · tilt{' '}
          {pol.tiltDeg.toFixed(0)}°
        </span>
      </div>
    </section>
  );
}
