import { cabs, carg, deriveLayeredSlab, type LayeredSlabState } from '@openem/physics-core';
import { LinePlot, type PlotSeries } from '../../components/plots/LinePlot';
import { formatSI } from '../../format';
import { useWaveLabStore } from '../../state/store';

const Row = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
    <span style={{ color: '#555' }}>{label}</span>
    <span style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{value}</span>
  </div>
);

const polar = (z: { re: number; im: number }): string =>
  `${cabs(z).toFixed(4)} ∠ ${((carg(z) * 180) / Math.PI).toFixed(1)}°`;

export function SlabSidebar() {
  const params = useWaveLabStore((s) => s.layeredSlab);
  const derived = deriveLayeredSlab(params);

  // R and T vs slab thickness for the current media, angle and polarization.
  const rPoints: [number, number][] = [];
  const tPoints: [number, number][] = [];
  for (let i = 0; i <= 400; i++) {
    const thicknessLambda1 = (2 * i) / 400;
    const d = deriveLayeredSlab({ ...params, thicknessLambda1 });
    // Round away ~1e-30 floating-point residue so the axis floor reads 0.
    rPoints.push([thicknessLambda1, Math.round(d.R * 1e12) / 1e12]);
    tPoints.push([thicknessLambda1, Math.round(d.T * 1e12) / 1e12]);
  }
  const series: PlotSeries[] = [
    { label: 'R', color: '#e11d48', points: rPoints },
    { label: 'T', color: '#0ea5e9', points: tPoints },
  ];

  const slabLabel =
    derived.slabRegime === 'evanescent' ? 'evanescent (frustrated TIR)' : 'propagating';
  const exitLabel = derived.exitRegime === 'evanescent' ? 'evanescent (TIR, T = 0)' : 'propagating';

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
      <h3 style={{ margin: '0 0 2px', fontSize: 13 }}>Reflection and transmission</h3>
      <Row label="slab field" value={slabLabel} />
      <Row label="medium 3" value={exitLabel} />
      <Row label={params.polarization === 'TM' ? 'r (Hy ratio)' : 'r'} value={polar(derived.r)} />
      <Row label="t" value={polar(derived.t)} />
      <Row label="R = |r|²" value={derived.R.toFixed(4)} />
      <Row label="T (from flux)" value={derived.T.toFixed(4)} />
      <Row label="R + T" value={(derived.R + derived.T).toFixed(6)} />
      <Row label="d" value={formatSI(derived.thicknessM, 'm')} />
      {derived.slabDecayLengthM !== null && (
        <Row label="slab decay length 1/κ" value={formatSI(derived.slabDecayLengthM, 'm')} />
      )}
      {derived.reflectancePeriodLambda1 !== null && (
        <Row
          label={
            derived.airyMaxReflectance !== null ? 'R = 0 spacing π/k_z2' : 'R(d) period π/k_z2'
          }
          value={`${derived.reflectancePeriodLambda1.toFixed(4)} λ₁`}
        />
      )}
      {derived.airyMaxReflectance !== null && (
        <Row label="Airy peak R" value={derived.airyMaxReflectance.toFixed(4)} />
      )}

      <h3 style={{ margin: '8px 0 2px', fontSize: 13 }}>R, T vs slab thickness</h3>
      <LinePlot series={series} xLabel="d / λ₁" yLabel="power" markerX={params.thicknessLambda1} />
      <p style={{ margin: 0, color: '#777' }}>
        Red: R · blue: T · dashed line: current thickness.
        {derived.exitRegime === 'evanescent' &&
          ' Medium 3 is beyond its critical angle, so T = 0 and R = 1 for every thickness.'}
        {derived.exitRegime === 'propagating' &&
          derived.slabRegime === 'evanescent' &&
          ' The slab is beyond its critical angle, so T falls off as exp(−2κd): power tunnels across.'}
        {derived.reflectancePeriodLambda1 !== null &&
          ' Multiple reflections interfere, so R(d) repeats every π/k_z2 of thickness.'}
      </p>
    </section>
  );
}

export function SlabDiscreteControls() {
  const params = useWaveLabStore((s) => s.layeredSlab);
  const setParam = useWaveLabStore((s) => s.setSlabParam);

  const presets: { label: string; values: Partial<LayeredSlabState> }[] = [
    {
      label: 'Frustrated TIR',
      values: {
        eps1R: 4,
        eps2R: 1,
        eps3R: 4,
        thetaDeg: 60,
        polarization: 'TE',
        thicknessLambda1: 0.3,
      },
    },
    {
      label: 'Fabry–Pérot',
      // Half of the R = 0 spacing 1/sqrt(5) lambda_1: the Airy reflectance peak, R = 4/9.
      values: {
        eps1R: 4,
        eps2R: 8,
        eps3R: 4,
        thetaDeg: 60,
        polarization: 'TE',
        thicknessLambda1: 1 / (2 * Math.sqrt(5)),
      },
    },
    {
      label: 'Quarter-wave AR',
      values: {
        eps1R: 1,
        eps2R: 1.5,
        eps3R: 2.25,
        thetaDeg: 0,
        thicknessLambda1: Math.sqrt(1 / 1.5) / 4,
      },
    },
    {
      label: 'Half-wave layer',
      values: { eps1R: 1, eps2R: 4, eps3R: 1, thetaDeg: 0, thicknessLambda1: 0.25 },
    },
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
                setParam(k as keyof LayeredSlabState, v as never);
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
              name="slab-polarization"
              checked={params.polarization === pol}
              onChange={() => setParam('polarization', pol)}
            />{' '}
            {pol} {pol === 'TE' ? '(E = Ey)' : '(H = Hy)'}
          </label>
        ))}
      </div>
    </div>
  );
}
