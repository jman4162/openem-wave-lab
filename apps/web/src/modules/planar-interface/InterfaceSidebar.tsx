import {
  cabs,
  carg,
  derivePlanarInterface,
  interfaceFieldsAt,
  timeAveragedPoynting,
  type PlanarInterfaceState,
} from '@openem/physics-core';
import { LinePlot, type PlotSeries } from '../../components/plots/LinePlot';
import { formatComplex, formatSI } from '../../format';
import { useWaveLabStore } from '../../state/store';

const REGIME_LABELS: Record<string, string> = {
  propagating: 'propagating',
  evanescent: 'TIR — evanescent',
  lossy: 'lossy transmission',
  pec: 'PEC wall',
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
    <span style={{ color: '#555' }}>{label}</span>
    <span style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{value}</span>
  </div>
);

export function InterfaceSidebar() {
  const params = useWaveLabStore((s) => s.planarInterface);
  const probeX = useWaveLabStore((s) => s.probeX);
  const probeZ = useWaveLabStore((s) => s.probeZ);
  const setProbeX = useWaveLabStore((s) => s.setProbeX);
  const setProbeZ = useWaveLabStore((s) => s.setProbeZ);

  const derived = derivePlanarInterface(params);
  const lambda = derived.wavelength1M;

  // R/T vs incidence angle for the current media and polarization.
  const rPoints: [number, number][] = [];
  const tPoints: [number, number][] = [];
  for (let deg = 0; deg <= 89.5; deg += 0.5) {
    const d = derivePlanarInterface({ ...params, thetaDeg: deg });
    rPoints.push([deg, d.R]);
    tPoints.push([deg, d.T]);
  }
  const series: PlotSeries[] = [
    { label: 'R', color: '#e11d48', points: rPoints },
    { label: 'T', color: '#0ea5e9', points: tPoints },
  ];

  const f = interfaceFieldsAt(params, derived, probeX * lambda, probeZ * lambda, 0);
  const S = timeAveragedPoynting(f.Ephasor, f.Hphasor);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
      <h3 style={{ margin: '8px 0 2px', fontSize: 13 }}>Reflection and transmission</h3>
      <Row label="regime" value={REGIME_LABELS[derived.regime] ?? derived.regime} />
      <Row
        label={params.polarization === 'TM' ? 'r (Hy ratio)' : 'r'}
        value={`${cabs(derived.r).toFixed(4)} ∠ ${((carg(derived.r) * 180) / Math.PI).toFixed(1)}°`}
      />
      <Row
        label="t"
        value={`${cabs(derived.t).toFixed(4)} ∠ ${((carg(derived.t) * 180) / Math.PI).toFixed(1)}°`}
      />
      <Row label="R = |r|²" value={derived.R.toFixed(4)} />
      <Row label="T (from flux)" value={derived.T.toFixed(4)} />
      <Row label="R + T" value={(derived.R + derived.T).toFixed(6)} />
      {derived.thetaBrewsterDeg !== null && (
        <Row label="Brewster θ_B" value={`${derived.thetaBrewsterDeg.toFixed(2)}°`} />
      )}
      {derived.thetaCriticalDeg !== null && (
        <Row label="critical θ_c" value={`${derived.thetaCriticalDeg.toFixed(2)}°`} />
      )}
      {derived.penetrationDepthM !== null && (
        <Row label="penetration depth" value={formatSI(derived.penetrationDepthM, 'm')} />
      )}

      <h3 style={{ margin: '8px 0 2px', fontSize: 13 }}>R, T vs incidence angle</h3>
      <LinePlot series={series} xLabel="θ (deg)" yLabel="power" markerX={params.thetaDeg} />
      <p style={{ margin: 0, color: '#777' }}>
        Red: R · blue: T · dashed line: current angle.
        {derived.thetaBrewsterDeg !== null &&
          ` R touches zero at Brewster (${derived.thetaBrewsterDeg.toFixed(1)}°).`}
        {derived.thetaCriticalDeg !== null &&
          ` R reaches 1 at the critical angle (${derived.thetaCriticalDeg.toFixed(1)}°).`}
      </p>

      <h3 style={{ margin: '8px 0 2px', fontSize: 13 }}>Probe</h3>
      {(
        [
          ['x', probeX, setProbeX, -2, 2],
          ['z', probeZ, setProbeZ, -2.5, 1.5],
        ] as const
      ).map(([axis, value, setter, min, max]) => (
        <label key={axis} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>
              {axis} ({axis === 'z' ? 'medium 1 below 0' : 'along interface'})
            </span>
            <span style={{ fontFamily: 'monospace' }}>{value.toFixed(2)} λ₁</span>
          </span>
          <input
            type="range"
            min={min}
            max={max}
            step={0.01}
            value={value}
            onChange={(e) => setter(parseFloat(e.target.value))}
            aria-label={`Probe ${axis} in wavelengths`}
          />
        </label>
      ))}
      <Row label="Ẽx" value={formatComplex(f.Ephasor.x, 'V/m')} />
      <Row label="Ẽy" value={formatComplex(f.Ephasor.y, 'V/m')} />
      <Row label="Ẽz" value={formatComplex(f.Ephasor.z, 'V/m')} />
      <Row label="H̃x" value={formatComplex(f.Hphasor.x, 'A/m')} />
      <Row label="H̃y" value={formatComplex(f.Hphasor.y, 'A/m')} />
      <Row label="⟨S⟩" value={`(${formatSI(S.x, '', 3)}, ${formatSI(S.z, '', 3)}) W/m²`} />
    </section>
  );
}

export function InterfaceDiscreteControls() {
  const params = useWaveLabStore((s) => s.planarInterface);
  const setParam = useWaveLabStore((s) => s.setInterfaceParam);

  const presets: { label: string; values: Partial<PlanarInterfaceState> }[] = [
    {
      label: 'Brewster',
      values: { eps1R: 1, eps2R: 4, polarization: 'TM', thetaDeg: 63.43, sigma2: 0, pec: false },
    },
    {
      label: 'TIR',
      values: { eps1R: 4, eps2R: 1, polarization: 'TE', thetaDeg: 45, sigma2: 0, pec: false },
    },
    { label: 'Lossy', values: { eps1R: 1, eps2R: 4, sigma2: 0.3, pec: false } },
    { label: 'PEC mirror', values: { pec: true, thetaDeg: 0 } },
  ];

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, marginBottom: 10 }}
    >
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              for (const [k, v] of Object.entries(p.values)) {
                setParam(k as keyof PlanarInterfaceState, v as never);
              }
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        {(['TE', 'TM'] as const).map((pol) => (
          <label key={pol}>
            <input
              type="radio"
              name="polarization"
              checked={params.polarization === pol}
              onChange={() => setParam('polarization', pol)}
            />{' '}
            {pol} {pol === 'TE' ? '(E = Ey)' : '(H = Hy)'}
          </label>
        ))}
      </div>
      <label>
        <input
          type="checkbox"
          checked={params.pec}
          onChange={(e) => setParam('pec', e.target.checked)}
        />{' '}
        Medium 2 is a perfect electric conductor
      </label>
    </div>
  );
}
