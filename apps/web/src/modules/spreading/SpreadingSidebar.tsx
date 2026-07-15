import { cabs, deriveSpreading, spreadingFieldsAt } from '@openem/physics-core';
import { LinePlot, type PlotSeries } from '../../components/plots/LinePlot';
import { formatSI } from '../../format';
import { useWaveLabStore, type SpreadingViewKind } from '../../state/store';

const KIND_LABELS: Record<SpreadingViewKind, string> = {
  plane: 'Plane',
  cylindrical: 'Cylindrical',
  spherical: 'Spherical',
};

export function SpreadingSidebar() {
  const params = useWaveLabStore((s) => s.spreading);
  const probeRho = useWaveLabStore((s) => s.probeRho);
  const kind = useWaveLabStore((s) => s.spreadingKind);
  const compare = useWaveLabStore((s) => s.spreadingCompare);
  const envelope = useWaveLabStore((s) => s.spreadingEnvelope);
  const logPlot = useWaveLabStore((s) => s.spreadingLogPlot);
  const view3d = useWaveLabStore((s) => s.spreadingView3d);
  const store = useWaveLabStore.getState();

  const derived = deriveSpreading(params);
  const lambda = derived.wavelengthM;

  // Radial amplitude samples for the plots and the probe readout.
  const rMin = 0.3;
  const rMax = 4;
  const samples: { r: number; plane: number; cyl: number; asym: number; sph: number }[] = [];
  for (let i = 0; i <= 120; i++) {
    const r = rMin + ((rMax - rMin) * i) / 120;
    const f = spreadingFieldsAt(params, derived, r * lambda, 0);
    samples.push({
      r,
      plane: cabs(f.psiPlane),
      cyl: cabs(f.psiCylindrical),
      asym: cabs(f.psiCylAsymptotic),
      sph: cabs(f.psiSpherical),
    });
  }
  const amplitudeSeries: PlotSeries[] = [
    { label: 'plane', color: '#a3a3a3', points: samples.map((s) => [s.r, s.plane]) },
    { label: 'cylindrical', color: '#0ea5e9', points: samples.map((s) => [s.r, s.cyl]) },
    {
      label: '1/√ρ asymptote',
      color: '#0ea5e9',
      dash: '4 3',
      points: samples.map((s) => [s.r, s.asym]),
    },
    { label: 'spherical', color: '#e11d48', points: samples.map((s) => [s.r, s.sph]) },
  ];
  const intensitySeries: PlotSeries[] = amplitudeSeries.map((s) => ({
    ...s,
    points: s.points.map(([r, a]) => [r, a * a] as [number, number]),
  }));

  const probe = spreadingFieldsAt(params, derived, probeRho * lambda, 0);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
      <h3 style={{ margin: '8px 0 0', fontSize: 13 }}>View</h3>
      <label>
        <input
          type="checkbox"
          checked={compare}
          onChange={(e) => store.setSpreadingCompare(e.target.checked)}
        />{' '}
        Compare all three (plane | cylindrical | spherical)
      </label>
      <label>
        <input
          type="checkbox"
          checked={view3d}
          onChange={(e) => store.setSpreadingView3d(e.target.checked)}
        />{' '}
        3D surface (orbit with drag / pinch) — single wave only
      </label>
      {!compare && (
        <div style={{ display: 'flex', gap: 8 }}>
          {(Object.keys(KIND_LABELS) as SpreadingViewKind[]).map((k) => (
            <label key={k}>
              <input
                type="radio"
                name="wave-kind"
                checked={kind === k}
                onChange={() => store.setSpreadingKind(k)}
              />{' '}
              {KIND_LABELS[k]}
            </label>
          ))}
        </div>
      )}
      <label>
        <input
          type="checkbox"
          checked={envelope}
          onChange={(e) => store.setSpreadingEnvelope(e.target.checked)}
        />{' '}
        Show |ψ| envelope instead of Re&#123;ψ&#125;
      </label>

      <h3 style={{ margin: '8px 0 0', fontSize: 13 }}>Radial probe</h3>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Radius</span>
          <span style={{ fontFamily: 'monospace' }}>
            {probeRho.toFixed(2)} λ = {formatSI(probeRho * lambda, 'm')}
          </span>
        </span>
        <input
          type="range"
          min={0.3}
          max={4}
          step={0.01}
          value={probeRho}
          onChange={(e) => store.setProbeRho(parseFloat(e.target.value))}
          aria-label="Probe radius in wavelengths"
        />
      </label>
      <table style={{ fontFamily: 'monospace', fontSize: 11, borderSpacing: 0 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>wave</th>
            <th style={{ textAlign: 'right' }}>|ψ|</th>
            <th style={{ textAlign: 'right' }}>|ψ|²</th>
          </tr>
        </thead>
        <tbody>
          {(
            [
              ['plane', probe.psiPlane],
              ['cylindrical', probe.psiCylindrical],
              ['spherical', probe.psiSpherical],
            ] as const
          ).map(([label, psi]) => (
            <tr key={label}>
              <td>{label}</td>
              <td style={{ textAlign: 'right' }}>{cabs(psi).toFixed(3)}</td>
              <td style={{ textAlign: 'right' }}>{(cabs(psi) ** 2).toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ margin: 0, color: '#777' }}>
        |ψ|² is scalar intensity, not E×H — this is a scalar model.
      </p>

      <h3 style={{ margin: '8px 0 0', fontSize: 13 }}>Amplitude vs radius</h3>
      <label>
        <input
          type="checkbox"
          checked={logPlot}
          onChange={(e) => store.setSpreadingLogPlot(e.target.checked)}
        />{' '}
        log-log (slopes read 0, −½, −1)
      </label>
      <LinePlot
        series={amplitudeSeries}
        xLabel="r / λ"
        yLabel="|ψ|"
        logX={logPlot}
        logY={logPlot}
        markerX={probeRho}
      />
      <LinePlot
        series={intensitySeries}
        xLabel="r / λ"
        yLabel="|ψ|²"
        logX={logPlot}
        logY={logPlot}
        markerX={probeRho}
      />
      <p style={{ margin: 0, color: '#777' }}>
        Gray: plane · blue: cylindrical H₀⁽¹⁾ (dashed: 1/√ρ asymptote) · red: spherical 1/r. Compare
        view shows plane | cylindrical | spherical left to right.
      </p>
    </section>
  );
}
