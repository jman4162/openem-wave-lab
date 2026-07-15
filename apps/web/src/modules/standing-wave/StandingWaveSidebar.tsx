import { useEffect, useState } from 'react';
import {
  deriveStandingWave,
  standingWaveEnvelopeAt,
  standingWavePhasorAt,
} from '@openem/physics-core';
import { formatSI } from '../../format';
import { useWaveLabStore } from '../../state/store';

const Row = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
    <span style={{ color: '#555' }}>{label}</span>
    <span style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{value}</span>
  </div>
);

export function StandingWaveSidebar() {
  const params = useWaveLabStore((s) => s.standingWave);
  const probeZSw = useWaveLabStore((s) => s.probeZSw);
  const setProbeZSw = useWaveLabStore((s) => s.setProbeZSw);

  const derived = deriveStandingWave(params);

  // Instantaneous probe value polls at 10 Hz (same pattern as ProbeReadout).
  const [instant, setInstant] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      const s = useWaveLabStore.getState();
      const d = deriveStandingWave(s.standingWave);
      const psi = standingWavePhasorAt(s.standingWave, d, s.probeZSw * d.wavelengthM);
      const omegaT = 2 * Math.PI * s.tau;
      setInstant(psi.re * Math.cos(omegaT) + psi.im * Math.sin(omegaT));
    }, 100);
    return () => clearInterval(id);
  }, []);

  const envelope = standingWaveEnvelopeAt(params, derived, probeZSw * derived.wavelengthM);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
      <h3 style={{ margin: '8px 0 2px', fontSize: 13 }}>Standing-wave structure</h3>
      <Row
        label="SWR"
        value={Number.isFinite(derived.swr) ? derived.swr.toFixed(3) : '∞ (full reflection)'}
      />
      <Row label="envelope max" value={`${derived.envelopeMaxV.toFixed(3)} V/m`} />
      <Row label="envelope min" value={`${derived.envelopeMinV.toFixed(3)} V/m`} />
      <Row label="minima spacing" value={`λ/2 = ${formatSI(derived.nodeSpacingM, 'm')}`} />
      <Row label="net flux / forward flux" value={`1 − |Γ|² = ${derived.netFluxNorm.toFixed(3)}`} />
      {derived.zLoadNorm !== null ? (
        <Row
          label="Z_load / η"
          value={`${derived.zLoadNorm.re.toFixed(2)} ${derived.zLoadNorm.im >= 0 ? '+' : '−'} j${Math.abs(derived.zLoadNorm.im).toFixed(2)}`}
        />
      ) : (
        <Row label="Z_load / η" value="∞ (open)" />
      )}

      <h4 style={{ margin: '6px 0 2px', fontSize: 12 }}>First four envelope minima (from wall)</h4>
      <table style={{ fontFamily: 'monospace', fontSize: 11, borderSpacing: 0 }}>
        <tbody>
          {[0, 1, 2, 3].map((m) => {
            const z = derived.firstMinZM - m * derived.nodeSpacingM;
            return (
              <tr key={m}>
                <td>min {m + 1}</td>
                <td style={{ textAlign: 'right' }}>{(z / derived.wavelengthM).toFixed(3)} λ</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h3 style={{ margin: '8px 0 2px', fontSize: 13 }}>Probe</h3>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Position z (wall at 0)</span>
          <span style={{ fontFamily: 'monospace' }}>{probeZSw.toFixed(3)} λ</span>
        </span>
        <input
          type="range"
          min={-4}
          max={0}
          step={0.005}
          value={probeZSw}
          onChange={(e) => setProbeZSw(parseFloat(e.target.value))}
          aria-label="Probe position in wavelengths"
        />
      </label>
      <Row label="E(z_p, t) — oscillates" value={`${instant.toFixed(3)} V/m`} />
      <Row label="|Ẽ(z_p)| — fixed" value={`${envelope.toFixed(3)} V/m`} />
      <Row label="⟨E²⟩ ∝ |Ẽ|²/2 — fixed" value={(0.5 * envelope * envelope).toFixed(3)} />
      <p style={{ margin: 0, color: '#777' }}>
        Put the probe on an envelope minimum, then scrub time: the instantaneous value still
        oscillates (and is nonzero unless |Γ| = 1), while the time-averaged minimum never moves. An
        instantaneous zero crossing sweeps along z; a node is where the ENVELOPE is minimal.
      </p>
      <p style={{ margin: 0, color: '#777' }}>
        Buttons: Short (Γ=−1), Open (Γ=+1), Matched (Γ=0) are presets over |Γ| and ∠Γ. Beats live in
        the Velocities module; 2D two-source interference is planned.
      </p>
    </section>
  );
}
