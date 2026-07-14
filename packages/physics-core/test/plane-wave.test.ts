import { describe, expect, it } from 'vitest';
import {
  cabs,
  carg,
  cdiv,
  cdotUnconjugated,
  cnormSq,
  cross,
  derivePlaneWave,
  defaultPlaneWaveState,
  dot,
  ETA_0,
  EPSILON_0,
  MU_0,
  fieldsAt,
  planeWaveModel,
  timeAveragedPoynting,
  type PlaneWaveState,
} from '@openem/physics-core';

const lossless: PlaneWaveState = { ...defaultPlaneWaveState, E0y: 0.5, phaseYDeg: 30 };
const lossy: PlaneWaveState = { ...lossless, epsilonR: 4, sigma: 0.05 };

describe('orthogonality (spec 6.1: E, H, k mutually orthogonal)', () => {
  it('instantaneous E . H = 0 and transversality, lossless medium', () => {
    const derived = derivePlaneWave(lossless);
    for (const [z, t] of [
      [0, 0],
      [0.013, 0.4e-9],
      [0.21, 0.77e-9],
    ] as const) {
      const f = fieldsAt(lossless, derived, z, t);
      const scaleEH = Math.hypot(f.E.x, f.E.y) * Math.hypot(f.H.x, f.H.y);
      expect(Math.abs(dot(f.E, f.H)) / scaleEH).toBeLessThan(1e-12);
      expect(f.E.z).toBe(0);
      expect(f.H.z).toBe(0);
    }
  });

  it('phasor E~ . H~ = 0 in lossy medium', () => {
    const derived = derivePlaneWave(lossy);
    const f = fieldsAt(lossy, derived, 0.05, 0);
    const residual =
      cabs(cdotUnconjugated(f.Ephasor, f.Hphasor)) /
      Math.sqrt(cnormSq(f.Ephasor) * cnormSq(f.Hphasor));
    expect(residual).toBeLessThan(1e-12);
  });
});

describe('impedance (spec 6.1: displayed impedance matches material model)', () => {
  it('free-space eta is 376.730 ohms and real', () => {
    const derived = derivePlaneWave(defaultPlaneWaveState);
    expect(derived.eta.re).toBeCloseTo(376.7303, 3);
    expect(derived.eta.im).toBeCloseTo(0, 12);
  });

  it('|E~x/H~y| = |eta| with matching phase, lossy medium', () => {
    const derived = derivePlaneWave(lossy);
    const f = fieldsAt(lossy, derived, 0.02, 0);
    const ratio = cdiv(f.Ephasor.x, f.Hphasor.y);
    expect(cabs(ratio)).toBeCloseTo(cabs(derived.eta), 10);
    expect(carg(ratio)).toBeCloseTo(carg(derived.eta), 12);
    // Under e^{-i omega t}, arg(eta) is in (-45 deg, 0) for a lossy medium
    // (the conjugate of the e^{+j omega t} value); H still lags E in time.
    expect(carg(derived.eta)).toBeLessThan(0);
    expect(carg(derived.eta)).toBeGreaterThan(-Math.PI / 4);
  });

  it('lossless limit eta = eta0 sqrt(muR/epsR)', () => {
    const state = { ...defaultPlaneWaveState, epsilonR: 9, muR: 4 };
    const derived = derivePlaneWave(state);
    expect(derived.eta.re).toBeCloseTo((ETA_0 * 2) / 3, 8);
    expect(derived.eta.im).toBeCloseTo(0, 12);
  });
});

describe('circular polarization (spec 6.1 acceptance criteria)', () => {
  const rhcp: PlaneWaveState = { ...defaultPlaneWaveState, E0x: 1, E0y: 1, phaseYDeg: 90 };

  it('|E(t)| is constant at a fixed point over a full period', () => {
    const derived = derivePlaneWave(rhcp);
    const T = derived.periodS;
    const mags: number[] = [];
    for (let n = 0; n < 32; n++) {
      const f = fieldsAt(rhcp, derived, 0.1, (n / 32) * T);
      mags.push(Math.hypot(f.E.x, f.E.y));
    }
    const [min, max] = [Math.min(...mags), Math.max(...mags)];
    expect((max - min) / max).toBeLessThan(1e-12);
  });

  it('delta = +90 deg rotates +x toward +y (IEEE right-handed for +z travel)', () => {
    const derived = derivePlaneWave(rhcp);
    const T = derived.periodS;
    const f0 = fieldsAt(rhcp, derived, 0, 0);
    const fq = fieldsAt(rhcp, derived, 0, T / 4);
    expect(f0.E.x).toBeGreaterThan(0);
    expect(Math.abs(f0.E.y)).toBeLessThan(1e-12);
    expect(fq.E.y).toBeGreaterThan(0);
    expect(Math.abs(fq.E.x)).toBeLessThan(1e-9);
    expect(derived.polarization.type).toBe('circular');
    expect(derived.polarization.handedness).toBe('RH');
  });

  it('handedness flips with the sign of delta; linear when delta = 0', () => {
    const lhcp = derivePlaneWave({ ...rhcp, phaseYDeg: -90 });
    expect(lhcp.polarization.handedness).toBe('LH');
    const linear = derivePlaneWave({ ...rhcp, phaseYDeg: 0 });
    expect(linear.polarization.type).toBe('linear');
    expect(linear.polarization.axialRatio).toBe(Infinity);
    expect(linear.polarization.tiltDeg).toBeCloseTo(45, 10);
  });
});

describe('Poynting vector computed from fields, never from k (spec 4.1, 6.1)', () => {
  it('numeric time average of E(t) x H(t) equals (1/2)Re{E~ x H~*}', () => {
    // The product of two sinusoids at omega has only DC and 2*omega content, so a
    // uniform N-point sample over one period averages it exactly for N > 2.
    for (const state of [lossless, lossy]) {
      const derived = derivePlaneWave(state);
      const T = derived.periodS;
      const z = 0.07;
      const N = 8;
      const avg = { x: 0, y: 0, z: 0 };
      for (let n = 0; n < N; n++) {
        const f = fieldsAt(state, derived, z, (n / N) * T);
        const s = cross(f.E, f.H);
        avg.x += s.x / N;
        avg.y += s.y / N;
        avg.z += s.z / N;
      }
      const f = fieldsAt(state, derived, z, 0);
      const Savg = timeAveragedPoynting(f.Ephasor, f.Hphasor);
      expect(avg.x).toBeCloseTo(Savg.x, 12);
      expect(avg.y).toBeCloseTo(Savg.y, 12);
      expect(avg.z / Savg.z).toBeCloseTo(1, 10);
      // Power flows along +z (into the passive medium).
      expect(Savg.z).toBeGreaterThan(0);
      expect(Math.hypot(Savg.x, Savg.y)).toBeLessThan(1e-12 * Savg.z);
    }
  });

  it('lossless: <S> = |E0|^2/(2 eta) with u_E = u_H', () => {
    const state = { ...defaultPlaneWaveState, E0x: 1, E0y: 0 };
    const derived = derivePlaneWave(state);
    const f = fieldsAt(state, derived, 0, 0);
    const Savg = timeAveragedPoynting(f.Ephasor, f.Hphasor);
    expect(Savg.z).toBeCloseTo(1 / (2 * ETA_0), 10);
    const uE = 0.25 * EPSILON_0 * cnormSq(f.Ephasor);
    const uH = 0.25 * MU_0 * cnormSq(f.Hphasor);
    expect(uE / uH).toBeCloseTo(1, 10);
  });
});

describe('lossy media decay (spec 6.1)', () => {
  it('field decays as e^{-alpha z}, power as e^{-2 alpha z}', () => {
    const derived = derivePlaneWave(lossy);
    expect(derived.alpha).toBeGreaterThan(0);
    const z1 = 0.05;
    const z2 = 0.22;
    const f1 = fieldsAt(lossy, derived, z1, 0);
    const f2 = fieldsAt(lossy, derived, z2, 0);
    const fieldRatio = Math.sqrt(cnormSq(f2.Ephasor) / cnormSq(f1.Ephasor));
    expect(fieldRatio).toBeCloseTo(Math.exp(-derived.alpha * (z2 - z1)), 10);
    const S1 = timeAveragedPoynting(f1.Ephasor, f1.Hphasor);
    const S2 = timeAveragedPoynting(f2.Ephasor, f2.Hphasor);
    expect(S2.z / S1.z).toBeCloseTo(Math.exp(-2 * derived.alpha * (z2 - z1)), 10);
  });

  it('sigma -> 0 recovers the lossless limit', () => {
    const derived = derivePlaneWave({ ...lossy, sigma: 0 });
    expect(derived.alpha).toBe(0);
    expect(derived.skinDepthM).toBeNull();
    expect(derived.eta.im).toBeCloseTo(0, 12);
  });

  it('good conductor: alpha approaches sqrt(omega mu sigma / 2)', () => {
    const copperish: PlaneWaveState = {
      ...defaultPlaneWaveState,
      frequencyHz: 1e9,
      sigma: 5.8e7,
    };
    const derived = derivePlaneWave(copperish);
    const expected = Math.sqrt((derived.omega * MU_0 * copperish.sigma) / 2);
    expect(derived.alpha / expected).toBeCloseTo(1, 6);
    // Skin depth of copper at 1 GHz is about 2.09 micrometers.
    expect(derived.skinDepthM).toBeCloseTo(2.09e-6, 7);
  });
});

describe('convention pin (docs/physics-conventions.md): e^{-i omega t}', () => {
  it('Im(eps_c) > 0 and Im(k) > 0 for sigma > 0', () => {
    const derived = derivePlaneWave(lossy);
    expect(derived.epsilonComplex.im).toBeGreaterThan(0);
    expect(derived.k.im).toBeGreaterThan(0);
  });

  it('outgoing wave e^{ikz} decays with +z in a lossy medium', () => {
    const derived = derivePlaneWave(lossy);
    const near = fieldsAt(lossy, derived, 0, 0);
    const far = fieldsAt(lossy, derived, 5 * (derived.skinDepthM ?? 1), 0);
    expect(cnormSq(far.Ephasor)).toBeLessThan(cnormSq(near.Ephasor));
  });

  it('vacuum sanity: lambda = c/f, v_p = c', () => {
    const derived = derivePlaneWave(defaultPlaneWaveState);
    expect(derived.wavelengthM).toBeCloseTo(0.299792458, 9);
    expect(derived.phaseVelocity / 299792458).toBeCloseTo(1, 12);
  });
});

describe('model contract', () => {
  it('validate() passes for lossless and lossy states', () => {
    for (const state of [lossless, lossy]) {
      for (const result of planeWaveModel.validate(state)) {
        expect(result.pass, `${result.id}: residual ${result.residual}`).toBe(true);
      }
    }
  });

  it('sampleField returns interleaved arrays consistent with fieldsAt', () => {
    const points = new Float32Array([0, 0, 0, 0, 0, 0.1]);
    const t = 0.3e-9;
    const sample = planeWaveModel.sampleField(lossy, points, t);
    expect(sample.count).toBe(2);
    const derived = derivePlaneWave(lossy);
    const f = fieldsAt(lossy, derived, 0.1, t);
    expect(sample.E[3]).toBeCloseTo(f.E.x, 6);
    expect(sample.E[4]).toBeCloseTo(f.E.y, 6);
    expect(sample.Ephasor[6]).toBeCloseTo(f.Ephasor.x.re, 6);
  });

  it('observables include distinctly labeled instantaneous and averaged S', () => {
    const obs = planeWaveModel.observables(lossless, { x: 0, y: 0, z: 0.1 }, 0.1e-9);
    const ids = obs.map((o) => o.id);
    expect(ids).toContain('S-inst');
    expect(ids).toContain('S-avg');
    expect(ids).toContain('u-E');
    expect(ids).toContain('u-H');
  });
});
