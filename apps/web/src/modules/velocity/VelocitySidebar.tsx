import { deriveVelocity } from '@openem/physics-core';
import { LinePlot, type PlotSeries } from '../../components/plots/LinePlot';
import { formatSI } from '../../format';
import { useWaveLabStore, type VelocityView } from '../../state/store';

const Row = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
    <span style={{ color: '#555' }}>{label}</span>
    <span style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{value}</span>
  </div>
);

const VIEWS: { id: VelocityView; label: string }[] = [
  { id: 'beat', label: 'Two-frequency beat' },
  { id: 'pulse', label: 'Gaussian pulse' },
];

export function VelocitySidebar() {
  const params = useWaveLabStore((s) => s.velocity);
  const view = useWaveLabStore((s) => s.velocityView);
  const setView = useWaveLabStore((s) => s.setVelocityView);

  const derived = deriveVelocity(params);

  // Dispersion diagram in normalized units (k/k̄, ω/ω̄).
  const curve: [number, number][] = [];
  for (let i = 0; i <= 100; i++) {
    const k = (i / 100) * 2 * derived.k;
    const w = Math.sqrt(derived.omegaC ** 2 + derived.cM ** 2 * k * k);
    curve.push([k / derived.k, w / derived.omega]);
  }
  const dk = 0.35 * derived.k;
  const series: PlotSeries[] = [
    { label: 'ω(k)', color: '#e11d48', points: curve },
    {
      label: 'chord v_p',
      color: '#f59e0b',
      points: [
        [0, 0],
        [1, 1],
      ],
    },
    {
      label: 'tangent v_g',
      color: '#34d399',
      points: [
        [(derived.k - dk) / derived.k, (derived.omega - derived.vG * dk) / derived.omega],
        [(derived.k + dk) / derived.k, (derived.omega + derived.vG * dk) / derived.omega],
      ],
    },
    {
      label: 'light line',
      color: '#9ca3af',
      dash: '4 3',
      points: [
        [0, 0],
        [2, (2 * derived.cM * derived.k) / derived.omega],
      ],
    },
    {
      label: 'operating point',
      color: '#ffffff',
      points: [
        [0.99, 0.99],
        [1.01, 1.01],
      ],
    },
  ];

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
      <h3 style={{ margin: '8px 0 2px', fontSize: 13 }}>View</h3>
      <div style={{ display: 'flex', gap: 12 }}>
        {VIEWS.map((v) => (
          <label key={v.id}>
            <input
              type="radio"
              name="velocity-view"
              checked={view === v.id}
              onChange={() => setView(v.id)}
            />{' '}
            {v.label}
          </label>
        ))}
      </div>

      <h3 style={{ margin: '8px 0 2px', fontSize: 13 }}>Velocities</h3>
      <Row label="phase v_p (amber crest)" value={formatSI(derived.vP, 'm/s')} />
      <Row label="group v_g (green envelope)" value={formatSI(derived.vG, 'm/s')} />
      <Row label="energy v_E (= v_g, lossless)" value={formatSI(derived.vE, 'm/s')} />
      <Row label="medium light speed c_m" value={formatSI(derived.cM, 'm/s')} />
      <Row label="v_p / c_m" value={(derived.vP / derived.cM).toFixed(4)} />
      <Row label="v_g / c_m" value={(derived.vG / derived.cM).toFixed(4)} />
      <Row label="beat wavelength" value={formatSI(derived.beatWavelengthM, 'm')} />
      <Row label="GVD ω″" value={formatSI(derived.gvd, 'm²/s')} />
      {derived.warnings.map((w) => (
        <p key={w} style={{ margin: 0, color: '#b45309' }}>
          ⚠ {w}
        </p>
      ))}

      <h3 style={{ margin: '8px 0 2px', fontSize: 13 }}>Dispersion diagram ω(k)</h3>
      <LinePlot series={series} xLabel="k / k̄" yLabel="ω / ω̄" />
      <p style={{ margin: 0, color: '#777' }}>
        Red: ω(k) · amber: chord from origin (slope v_p) · green: tangent (slope v_g) · dashed:
        light line ω = c_m k. The chord is always steeper than the tangent above cutoff.
      </p>
    </section>
  );
}
