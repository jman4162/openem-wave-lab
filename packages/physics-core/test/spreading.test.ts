import { describe, expect, it } from 'vitest';
import {
  cabs,
  carg,
  deriveSpreading,
  defaultSpreadingState,
  radialFluxCylindrical,
  radialFluxSpherical,
  spreadingFieldsAt,
  spreadingModel,
  type SpreadingState,
} from '@openem/physics-core';

const state: SpreadingState = { ...defaultSpreadingState };
const derived = deriveSpreading(state);
const { wavelengthM: lambda, k } = derived;

const at = (r: number) => spreadingFieldsAt(state, derived, r, 0);

describe('spreading amplitudes (spec 6.2-6.3 learning objective)', () => {
  it('all three waves have amplitude A at the reference radius', () => {
    const f = at(derived.refRadiusM);
    expect(cabs(f.psiPlane)).toBeCloseTo(state.amplitude, 10);
    expect(cabs(f.psiCylindrical)).toBeCloseTo(state.amplitude, 10);
    expect(cabs(f.psiSpherical)).toBeCloseTo(state.amplitude, 10);
  });

  it('plane wave does not spread; spherical halves when radius doubles', () => {
    expect(cabs(at(3 * lambda).psiPlane)).toBeCloseTo(cabs(at(1.5 * lambda).psiPlane), 12);
    const ratio = cabs(at(4 * lambda).psiSpherical) / cabs(at(2 * lambda).psiSpherical);
    expect(ratio).toBeCloseTo(0.5, 12);
  });

  it('cylindrical decays like 1/sqrt(rho) in the far field', () => {
    const ratio = cabs(at(40 * lambda).psiCylindrical) / cabs(at(10 * lambda).psiCylindrical);
    expect(ratio).toBeCloseTo(0.5, 3);
  });

  it('spherical decays faster than cylindrical', () => {
    const rho = 10 * lambda;
    expect(cabs(at(rho).psiSpherical)).toBeLessThan(cabs(at(rho).psiCylindrical));
  });
});

describe('excluded source region (spec 6.2 safeguard)', () => {
  it('radiating fields are zero inside r < lambda/4; plane wave is not', () => {
    const f = spreadingFieldsAt(state, derived, derived.rhoMinM / 2, 0);
    expect(cabs(f.psiCylindrical)).toBe(0);
    expect(cabs(f.psiSpherical)).toBe(0);
    expect(cabs(f.psiPlane)).toBeCloseTo(state.amplitude, 10);
  });
});

describe('far-field asymptote', () => {
  it('exact Hankel and asymptote agree within 2% at k*rho = 25, improving with radius', () => {
    const relErr = (r: number): number => {
      const f = at(r);
      return (
        Math.hypot(
          f.psiCylindrical.re - f.psiCylAsymptotic.re,
          f.psiCylindrical.im - f.psiCylAsymptotic.im,
        ) / cabs(f.psiCylindrical)
      );
    };
    expect(relErr(25 / k)).toBeLessThan(0.02);
    expect(relErr(50 / k)).toBeLessThan(relErr(25 / k));
  });
});

describe('flux conservation computed from the fields', () => {
  it('rho * Im{psi* dpsi} equals the Bessel-Wronskian value 2C²/π at any radius', () => {
    const exact = (2 * derived.normCyl ** 2) / Math.PI;
    for (const r of [0.5 * lambda, lambda, 2.3 * lambda, 10 * lambda]) {
      expect((r * radialFluxCylindrical(derived, r)) / exact).toBeCloseTo(1, 6);
    }
  });

  it('r² * spherical flux is radius-independent (4πr²|psi|² constant)', () => {
    const q1 = (2 * lambda) ** 2 * radialFluxSpherical(derived, 2 * lambda);
    const q2 = (7 * lambda) ** 2 * radialFluxSpherical(derived, 7 * lambda);
    expect(q1 / q2).toBeCloseTo(1, 12);
  });
});

describe('convention pin: outgoing waves under e^{-i omega t}', () => {
  it('phase increases with radius and flux is outward', () => {
    const r = 2 * lambda;
    const dr = lambda / 100;
    for (const pick of ['psiCylindrical', 'psiSpherical'] as const) {
      const p1 = carg(at(r)[pick]);
      let p2 = carg(at(r + dr)[pick]);
      while (p2 < p1 - Math.PI) p2 += 2 * Math.PI;
      expect(p2, pick).toBeGreaterThan(p1);
    }
    expect(radialFluxCylindrical(derived, r)).toBeGreaterThan(0);
    expect(radialFluxSpherical(derived, r)).toBeGreaterThan(0);
  });
});

describe('model contract', () => {
  it('validate() passes for default and dielectric states', () => {
    for (const s of [state, { ...state, epsilonR: 9, frequencyHz: 3e9 }]) {
      for (const result of spreadingModel.validate(s)) {
        expect(result.pass, `${result.id}: residual ${result.residual}`).toBe(true);
      }
    }
  });

  it('sampleField phasors match spreadingFieldsAt', () => {
    const r = 1.7 * lambda;
    const points = new Float32Array([r, 0, 0]);
    const sample = spreadingModel.sampleField(state, points, 0);
    const f = at(r);
    expect(sample.psiCylindrical[0]).toBeCloseTo(f.psiCylindrical.re, 6);
    expect(sample.psiCylindrical[1]).toBeCloseTo(f.psiCylindrical.im, 6);
    expect(sample.psiSpherical[0]).toBeCloseTo(f.psiSpherical.re, 6);
  });

  it('observables label scalar intensity as not-E-x-H', () => {
    const obs = spreadingModel.observables(state, { x: 2 * lambda, y: 0, z: 0 });
    const intensity = obs.find((o) => o.id === 'sph-intensity');
    expect(intensity?.label).toContain('not E×H');
  });
});
