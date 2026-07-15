import { describe, expect, it } from 'vitest';
import {
  cabs,
  deriveStandingWave,
  defaultStandingWaveState,
  standingWaveEnvelopeAt,
  standingWaveFluxAt,
  standingWaveModel,
  standingWavePhasorAt,
  type StandingWaveState,
} from '@openem/physics-core';

const base: StandingWaveState = { ...defaultStandingWaveState }; // short: |G|=1, 180 deg

const derive = (over: Partial<StandingWaveState>) => deriveStandingWave({ ...base, ...over });

describe('terminations', () => {
  it('short (Γ = -1): E~ vanishes at the wall for all sampled times', () => {
    const d = derive({});
    const atWall = standingWavePhasorAt(base, d, 0);
    expect(cabs(atWall)).toBeLessThan(1e-12);
    // Nulls repeat every lambda/2 into medium 1.
    expect(standingWaveEnvelopeAt(base, d, -d.wavelengthM / 2)).toBeLessThan(1e-9);
    // Antinode between them.
    expect(standingWaveEnvelopeAt(base, d, -d.wavelengthM / 4)).toBeCloseTo(2 * base.E0, 9);
  });

  it('open (Γ = +1): antinode at the wall', () => {
    const state = { ...base, gammaPhaseDeg: 0 };
    const d = deriveStandingWave(state);
    expect(standingWaveEnvelopeAt(state, d, 0)).toBeCloseTo(2 * base.E0, 10);
  });

  it('matched (Γ = 0): flat envelope, pure traveling wave', () => {
    const state = { ...base, gammaMag: 0 };
    const d = deriveStandingWave(state);
    const values: number[] = [];
    for (let i = 0; i <= 100; i++) {
      values.push(standingWaveEnvelopeAt(state, d, (-i / 100) * d.wavelengthM));
    }
    expect(Math.max(...values) - Math.min(...values)).toBeLessThan(1e-12);
    expect(d.swr).toBeCloseTo(1, 12);
  });
});

describe('SWR and node structure', () => {
  it('envelope max/min = SWR for partial reflection', () => {
    const state = { ...base, gammaMag: 0.5, gammaPhaseDeg: 60 };
    const d = deriveStandingWave(state);
    let mx = 0;
    let mn = Infinity;
    for (let i = 0; i <= 2000; i++) {
      const e = standingWaveEnvelopeAt(state, d, (-i / 2000) * 2 * d.wavelengthM);
      mx = Math.max(mx, e);
      mn = Math.min(mn, e);
    }
    // Sweep extrema carry O((k dz)^2) sampling error; the identity is exact.
    expect(mx / mn / d.swr).toBeCloseTo(1, 3);
    expect(d.swr).toBeCloseTo(3, 12); // (1+0.5)/(1-0.5)
  });

  it('numeric minima search finds lambda/2 spacing at the analytic positions', () => {
    const state = { ...base, gammaMag: 0.7, gammaPhaseDeg: -45 };
    const d = deriveStandingWave(state);
    // Scan for local minima over two wavelengths.
    const N = 8000;
    const span = 2 * d.wavelengthM;
    const minima: number[] = [];
    let prev = standingWaveEnvelopeAt(state, d, -span);
    let curr = standingWaveEnvelopeAt(state, d, -span + span / N);
    for (let i = 2; i <= N; i++) {
      const z = -span + (span * i) / N;
      const next = standingWaveEnvelopeAt(state, d, z);
      if (curr < prev && curr <= next) minima.push(z - span / N);
      prev = curr;
      curr = next;
    }
    expect(minima.length).toBe(4);
    for (let i = 1; i < minima.length; i++) {
      expect((minima[i] ?? 0) - (minima[i - 1] ?? 0)).toBeCloseTo(d.nodeSpacingM, 5);
    }
    // First analytic minimum lies in (-lambda/2, 0] and matches one found.
    expect(d.firstMinZM).toBeLessThanOrEqual(0);
    expect(d.firstMinZM).toBeGreaterThan(-d.wavelengthM / 2 - 1e-12);
    const nearest = Math.min(
      ...minima.map((z) => Math.abs(z - (d.firstMinZM - 2 * d.wavelengthM < z ? d.firstMinZM : z))),
    );
    void nearest;
    const matches = minima.some(
      (z) =>
        Math.abs(((z - d.firstMinZM) / d.nodeSpacingM) % 1) < 1e-3 ||
        Math.abs((((z - d.firstMinZM) / d.nodeSpacingM) % 1) - 1) < 1e-3 ||
        Math.abs((((z - d.firstMinZM) / d.nodeSpacingM) % 1) + 1) < 1e-3,
    );
    expect(matches).toBe(true);
  });
});

describe('conservation and convention', () => {
  it('net flux from the field is z-independent and equals 1 - |Γ|²', () => {
    for (const g of [0, 0.3, 0.8, 1]) {
      const state = { ...base, gammaMag: g, gammaPhaseDeg: 70 };
      const d = deriveStandingWave(state);
      for (const zFrac of [-0.11, -0.5, -0.93]) {
        expect(standingWaveFluxAt(state, d, zFrac * d.wavelengthM)).toBeCloseTo(1 - g * g, 9);
      }
    }
  });

  it('convention pin: forward-only wave has phase increasing with z', () => {
    const state = { ...base, gammaMag: 0 };
    const d = deriveStandingWave(state);
    const p1 = standingWavePhasorAt(state, d, -0.4 * d.wavelengthM);
    const p2 = standingWavePhasorAt(state, d, -0.4 * d.wavelengthM + d.wavelengthM / 64);
    let dPhase = Math.atan2(p2.im, p2.re) - Math.atan2(p1.im, p1.re);
    if (dPhase < -Math.PI) dPhase += 2 * Math.PI;
    expect(dPhase).toBeGreaterThan(0);
  });

  it('instantaneous zero crossings move; time-averaged minima do not (spec 6.8)', () => {
    const state = { ...base, gammaMag: 0.5, gammaPhaseDeg: 0 };
    const d = deriveStandingWave(state);
    const instantaneous = (z: number, t: number): number => {
      const psi = standingWavePhasorAt(state, d, z);
      return psi.re * Math.cos(d.omega * t) + psi.im * Math.sin(d.omega * t);
    };
    // Find an instantaneous zero at t = 0 away from envelope minima and show
    // the field there is nonzero at a later time (the zero moved).
    let zZero = NaN;
    for (let i = 1; i <= 4000; i++) {
      const z0 = (-(i - 1) / 4000) * d.wavelengthM;
      const z1 = (-i / 4000) * d.wavelengthM;
      if (Math.sign(instantaneous(z0, 0)) !== Math.sign(instantaneous(z1, 0))) {
        zZero = (z0 + z1) / 2;
        break;
      }
    }
    expect(Number.isFinite(zZero)).toBe(true);
    expect(Math.abs(instantaneous(zZero, 0))).toBeLessThan(0.02 * base.E0);
    expect(Math.abs(instantaneous(zZero, d.periodS / 4))).toBeGreaterThan(0.05 * base.E0);
    // Whereas the envelope minimum is fixed and nonzero for |Γ| < 1.
    expect(standingWaveEnvelopeAt(state, d, d.firstMinZM)).toBeCloseTo(0.5 * base.E0, 9);
  });
});

describe('model contract', () => {
  it('validate() passes for the preset terminations and custom Γ', () => {
    const cases: Partial<StandingWaveState>[] = [
      {},
      { gammaPhaseDeg: 0 },
      { gammaMag: 0 },
      { gammaMag: 0.6, gammaPhaseDeg: -120 },
    ];
    for (const over of cases) {
      for (const result of standingWaveModel.validate({ ...base, ...over })) {
        expect(result.pass, `${JSON.stringify(over)} ${result.id}: ${result.residual}`).toBe(true);
      }
    }
  });

  it('sampleField phasors match standingWavePhasorAt', () => {
    const d = deriveStandingWave(base);
    const z = -0.37 * d.wavelengthM;
    const sample = standingWaveModel.sampleField(base, new Float32Array([0, 0, z]), 0);
    const psi = standingWavePhasorAt(base, d, z);
    expect(sample.Ephasor[0]).toBeCloseTo(psi.re, 6);
    expect(sample.Ephasor[1]).toBeCloseTo(psi.im, 6);
  });
});
