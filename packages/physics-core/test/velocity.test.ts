import { describe, expect, it } from 'vitest';
import {
  deriveVelocity,
  defaultVelocityState,
  pulseWidthAt,
  velocityFieldsAt,
  velocityModel,
  type VelocityState,
} from '@openem/physics-core';

const base: VelocityState = { ...defaultVelocityState };

const derive = (over: Partial<VelocityState>) => deriveVelocity({ ...base, ...over });

describe('waveguide-dispersion identities', () => {
  it('v_p * v_g = c_m^2 across states', () => {
    for (const over of [
      {},
      { cutoffFraction: 0.3 },
      { cutoffFraction: 0.9 },
      { epsilonR: 4, frequencyHz: 3e9 },
    ]) {
      const d = derive(over);
      expect((d.vP * d.vG) / (d.cM * d.cM)).toBeCloseTo(1, 12);
      expect(d.vG).toBeLessThanOrEqual(d.cM * (1 + 1e-12));
      expect(d.vP).toBeGreaterThanOrEqual(d.cM * (1 - 1e-12));
    }
  });

  it('cutoff -> 0 recovers the non-dispersive medium', () => {
    const d = derive({ cutoffFraction: 0 });
    expect(d.vP / d.cM).toBeCloseTo(1, 12);
    expect(d.vG / d.cM).toBeCloseTo(1, 12);
    // Dimensionless GVD: omega'' * omega / c_m^2 = 1 - (v_g/c_m)^2.
    expect((d.gvd * d.omega) / (d.cM * d.cM)).toBeCloseTo(0, 12);
  });

  it('energy velocity equals group velocity (lossless)', () => {
    expect(derive({}).vE).toBe(derive({}).vG);
  });
});

describe('beat envelope moves at the group velocity (measured from the field)', () => {
  it('numeric envelope-peak velocity matches deltaOmega/deltaK', () => {
    const d = derive({ cutoffFraction: 0.6, deltaFraction: 0.08 });
    const env = (x: number, t: number): number => velocityFieldsAt(d, x, t).envelopeBeat;
    const peakNear = (guess: number, t: number): number => {
      const h = d.beatWavelengthM / 400;
      const y0 = env(guess - h, t);
      const y1 = env(guess, t);
      const y2 = env(guess + h, t);
      const denom = y0 - 2 * y1 + y2;
      return denom !== 0 ? guess + (h * (y0 - y2)) / (2 * denom) : guess;
    };
    const t1 = 5 * d.periodS;
    const t2 = 25 * d.periodS;
    const x1 = peakNear((d.deltaOmega * t1) / d.deltaK, t1);
    const x2 = peakNear((d.deltaOmega * t2) / d.deltaK, t2);
    const measured = (x2 - x1) / (t2 - t1);
    expect(measured / d.envelopeVelocity).toBeCloseTo(1, 8);
    // Finite-difference v_g approaches the tangent slope as the detuning shrinks.
    const dNarrow = derive({ deltaFraction: 0.02 });
    expect(dNarrow.envelopeVelocity / dNarrow.vG).toBeCloseTo(1, 3);
  });

  it('the carrier crest moves faster than the envelope when dispersive', () => {
    const d = derive({ cutoffFraction: 0.6 });
    const crestVelocity = (d.omega1 + d.omega2) / (d.k1 + d.k2);
    expect(crestVelocity).toBeGreaterThan(d.envelopeVelocity);
  });
});

describe('Gaussian pulse under quadratic dispersion', () => {
  it('measured second-moment width matches the sigma(t) law', () => {
    const d = derive({ cutoffFraction: 0.6, sigmaLambda: 2 });
    for (const nT of [0, 40, 120]) {
      const t = nT * d.periodS;
      // Second moment of the envelope around the moving center.
      const center = d.vG * t;
      const span = 12 * pulseWidthAt(d, t);
      const N = 4001;
      let m0 = 0;
      let m2 = 0;
      for (let i = 0; i < N; i++) {
        const x = center - span / 2 + (span * i) / (N - 1);
        const e = velocityFieldsAt(d, x, t).envelopePulse;
        const w = e * e; // intensity-weighted
        m0 += w;
        m2 += w * (x - center) ** 2;
      }
      const measured = Math.sqrt(m2 / m0);
      // Intensity-weighted Gaussian second moment is sigma/sqrt(2).
      expect(measured / (pulseWidthAt(d, t) / Math.SQRT2)).toBeCloseTo(1, 4);
    }
  });

  it('analytic pulse matches an exact-dispersion spectral sum for moderate spread', () => {
    const d = derive({ cutoffFraction: 0.5, sigmaLambda: 3 });
    const sigmaK = 1 / d.sigmaXM;
    const t = 20 * d.periodS;
    // Numeric synthesis with the EXACT omega(k), 128 spectral lines.
    const exactPsi = (x: number): number => {
      let re = 0;
      const N = 128;
      for (let i = 0; i < N; i++) {
        const kk = d.k + sigmaK * 8 * ((i + 0.5) / N - 0.5);
        const ww = Math.sqrt(d.omegaC ** 2 + d.cM ** 2 * kk ** 2);
        const weight = Math.exp(-((kk - d.k) ** 2) / (2 * sigmaK * sigmaK));
        re += weight * Math.cos(kk * x - ww * t);
      }
      // Normalize to unit peak amplitude scale of the analytic form.
      return re * ((sigmaK * 8) / N / (Math.sqrt(2 * Math.PI) * sigmaK));
    };
    const center = d.vG * t;
    let worst = 0;
    for (let i = -20; i <= 20; i++) {
      const x = center + (i / 20) * 3 * pulseWidthAt(d, t);
      const analytic = velocityFieldsAt(d, x, t).psiPulse;
      worst = Math.max(worst, Math.abs(analytic - exactPsi(x)));
    }
    // Third-order dispersion is the truncation error; a few percent of peak.
    expect(worst).toBeLessThan(0.05);
  });
});

describe('near-cutoff behavior (spec 8.2: warn, never silent nonsense)', () => {
  it('detuning is clamped with a warning and outputs stay finite', () => {
    const d = derive({ cutoffFraction: 0.95, deltaFraction: 0.2 });
    expect(d.warnings.length).toBeGreaterThan(0);
    expect(Number.isFinite(d.k1)).toBe(true);
    expect(d.k1).toBeGreaterThan(0);
    expect(Number.isFinite(d.envelopeVelocity)).toBe(true);
  });
});

describe('model contract and convention', () => {
  it('validate() passes for representative states', () => {
    for (const over of [{}, { cutoffFraction: 0 }, { cutoffFraction: 0.9, deltaFraction: 0.2 }]) {
      for (const result of velocityModel.validate({ ...base, ...over })) {
        expect(result.pass, `${JSON.stringify(over)} ${result.id}: ${result.residual}`).toBe(true);
      }
    }
  });

  it('convention pin: a beat crest moves toward +x as t increases', () => {
    const d = derive({});
    const psi = (x: number, t: number): number => velocityFieldsAt(d, x, t).psiBeat;
    // Follow the crest that is at x=0, t=0 (both components in phase there).
    const dt = d.periodS / 64;
    const expectedShift = ((d.omega1 + d.omega2) / (d.k1 + d.k2)) * dt;
    expect(expectedShift).toBeGreaterThan(0);
    expect(psi(expectedShift, dt)).toBeGreaterThan(psi(0, 0) - 1e-3);
  });

  it('sampleField matches velocityFieldsAt', () => {
    const d = derive({});
    const points = new Float32Array([0.1, 0, 0]);
    const t = 2.5 * d.periodS;
    const sample = velocityModel.sampleField(base, points, t);
    const f = velocityFieldsAt(d, 0.1, t);
    expect(sample.psiBeat[0]).toBeCloseTo(f.psiBeat, 5);
    expect(sample.envelopePulse[0]).toBeCloseTo(f.envelopePulse, 5);
  });
});
