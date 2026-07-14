import { useEffect, useState } from 'react';
import {
  cross,
  derivePlaneWave,
  fieldsAt,
  timeAveragedPoynting,
  EPSILON_0,
  MU_0,
  cnormSq,
  type FieldsAtPoint,
  type PlaneWaveDerived,
} from '@openem/physics-core';
import { useWaveLabStore } from '../../state/store';
import { formatComplex, formatSI } from '../../format';

interface Readout {
  fields: FieldsAtPoint;
  derived: PlaneWaveDerived;
  probeZ: number;
}

function computeReadout(): Readout {
  const { planeWave: params, tau, probeZeta } = useWaveLabStore.getState();
  const derived = derivePlaneWave(params);
  const probeZ = probeZeta * derived.wavelengthM;
  const fields = fieldsAt(params, derived, probeZ, tau * derived.periodS);
  return { fields, derived, probeZ };
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
    <span style={{ color: '#555' }}>{label}</span>
    <span style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{value}</span>
  </div>
);

/**
 * Numeric field readout at the probe. Polls the store at ~10 Hz instead of
 * subscribing per frame; only this small component re-renders.
 */
export function ProbeReadout() {
  const probeZeta = useWaveLabStore((s) => s.probeZeta);
  const setProbeZeta = useWaveLabStore((s) => s.setProbeZeta);
  const [readout, setReadout] = useState<Readout>(computeReadout);

  useEffect(() => {
    const id = setInterval(() => setReadout(computeReadout()), 100);
    return () => clearInterval(id);
  }, []);

  const { fields, derived, probeZ } = readout;
  const { planeWave: params } = useWaveLabStore.getState();
  const Sinst = cross(fields.E, fields.H);
  const Savg = timeAveragedPoynting(fields.Ephasor, fields.Hphasor);
  const uE = 0.25 * EPSILON_0 * params.epsilonR * cnormSq(fields.Ephasor);
  const uH = 0.25 * MU_0 * params.muR * cnormSq(fields.Hphasor);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
      <h3 style={{ margin: '8px 0 2px', fontSize: 13 }}>Probe</h3>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Position z</span>
          <span style={{ fontFamily: 'monospace' }}>
            {probeZeta.toFixed(2)} λ = {formatSI(probeZ, 'm')}
          </span>
        </span>
        <input
          type="range"
          min={0}
          max={2}
          step={0.01}
          value={probeZeta}
          onChange={(e) => setProbeZeta(parseFloat(e.target.value))}
          aria-label="Probe position in wavelengths"
        />
      </label>

      <Row label="Ẽx" value={formatComplex(fields.Ephasor.x, 'V/m')} />
      <Row label="Ẽy" value={formatComplex(fields.Ephasor.y, 'V/m')} />
      <Row label="H̃x" value={formatComplex(fields.Hphasor.x, 'A/m')} />
      <Row label="H̃y" value={formatComplex(fields.Hphasor.y, 'A/m')} />
      <Row
        label="E(t)"
        value={`(${formatSI(fields.E.x, '', 3)}, ${formatSI(fields.E.y, '', 3)}) V/m`}
      />
      <Row
        label="H(t)"
        value={`(${formatSI(fields.H.x, '', 3)}, ${formatSI(fields.H.y, '', 3)}) A/m`}
      />
      <Row label="η" value={formatComplex(derived.eta, 'Ω')} />
      <Row label="S(t) · ẑ (instantaneous)" value={formatSI(Sinst.z, 'W/m²')} />
      <Row label="⟨S⟩ · ẑ (time-averaged)" value={formatSI(Savg.z, 'W/m²')} />
      <Row label="⟨u_E⟩" value={formatSI(uE, 'J/m³')} />
      <Row label="⟨u_H⟩" value={formatSI(uH, 'J/m³')} />
    </section>
  );
}
