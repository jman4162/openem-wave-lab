import { cabs, carg } from '../math/complex';
import type { Observable, PhysicsModel, ValidationResult } from '../model';
import {
  deriveSpreading,
  radialFluxCylindrical,
  radialFluxSpherical,
  spreadingFieldsAt,
  type SpreadingDerived,
} from './fields';
import { defaultSpreadingState, spreadingParameters, type SpreadingState } from './state';

export type SpreadingWaveKind = 'plane' | 'cylindrical' | 'cyl-asymptotic' | 'spherical';

/** Phasors only, re/im interleaved (2N each); combine with e^{-i omega t} downstream. */
export interface SpreadingSample {
  count: number;
  psiPlane: Float32Array;
  psiCylindrical: Float32Array;
  psiCylAsymptotic: Float32Array;
  psiSpherical: Float32Array;
}

export const spreadingModel: PhysicsModel<SpreadingState, SpreadingSample, SpreadingDerived> = {
  id: 'spreading',
  fidelity: 'analytic',
  assumptions: [
    'Scalar Green-function fields - NOT the vector field of an electromagnetic source',
    'Lossless homogeneous isotropic medium (real k)',
    'Time-harmonic steady state, phasor convention Re{psi e^{-iωt}}',
    'Source region r < λ/4 excluded: the point/line-source expressions are singular at r = 0',
    'All three waves normalized to amplitude A at the reference radius r_ref = λ',
  ],
  parameters: spreadingParameters,

  derive: deriveSpreading,

  // Time parameter is unused: the sample carries phasors and the caller applies
  // the e^{-i omega t} rotation (see HeatmapLayer).
  sampleField(state, points, _time) {
    const derived = deriveSpreading(state);
    const count = Math.floor(points.length / 3);
    const sample: SpreadingSample = {
      count,
      psiPlane: new Float32Array(2 * count),
      psiCylindrical: new Float32Array(2 * count),
      psiCylAsymptotic: new Float32Array(2 * count),
      psiSpherical: new Float32Array(2 * count),
    };
    for (let i = 0; i < count; i++) {
      const f = spreadingFieldsAt(state, derived, points[3 * i] ?? 0, points[3 * i + 2] ?? 0);
      sample.psiPlane[2 * i] = f.psiPlane.re;
      sample.psiPlane[2 * i + 1] = f.psiPlane.im;
      sample.psiCylindrical[2 * i] = f.psiCylindrical.re;
      sample.psiCylindrical[2 * i + 1] = f.psiCylindrical.im;
      sample.psiCylAsymptotic[2 * i] = f.psiCylAsymptotic.re;
      sample.psiCylAsymptotic[2 * i + 1] = f.psiCylAsymptotic.im;
      sample.psiSpherical[2 * i] = f.psiSpherical.re;
      sample.psiSpherical[2 * i + 1] = f.psiSpherical.im;
    }
    return sample;
  },

  observables(state, point = { x: 0, y: 0, z: 0 }) {
    const derived = deriveSpreading(state);
    const r = Math.max(Math.hypot(point.x, point.z), derived.rhoMinM);
    const f = spreadingFieldsAt(state, derived, r, 0);
    const obs: Observable[] = [
      {
        id: 'radius',
        label: 'Probe radius',
        unit: 'm',
        symbol: 'r',
        kind: 'scalar',
        value: r,
      },
    ];
    const kinds: [string, string, typeof f.psiPlane][] = [
      ['plane', 'Plane wave', f.psiPlane],
      ['cyl', 'Cylindrical H0(kρ)', f.psiCylindrical],
      ['cyl-asym', 'Cylindrical asymptote', f.psiCylAsymptotic],
      ['sph', 'Spherical e^{ikr}/r', f.psiSpherical],
    ];
    for (const [id, label, psi] of kinds) {
      obs.push(
        {
          id: `${id}-amplitude`,
          label: `${label}: amplitude`,
          unit: '',
          symbol: '|\\psi|',
          kind: 'scalar',
          value: cabs(psi),
        },
        {
          id: `${id}-intensity`,
          label: `${label}: scalar intensity (|psi|², not E×H)`,
          unit: '',
          symbol: '|\\psi|^2',
          kind: 'scalar',
          value: cabs(psi) ** 2,
        },
        {
          id: `${id}-phase`,
          label: `${label}: phase`,
          unit: 'rad',
          symbol: '\\arg\\psi',
          kind: 'scalar',
          value: carg(psi),
        },
      );
    }
    obs.push(
      {
        id: 'flux-cyl-conserved',
        label: 'ρ·Im{ψ*∂ρψ} cylindrical (conserved)',
        unit: '',
        symbol: '\\rho F_\\rho',
        kind: 'scalar',
        value: r * radialFluxCylindrical(derived, r),
      },
      {
        id: 'flux-sph-conserved',
        label: 'r²·Im{ψ*∂rψ} spherical (conserved)',
        unit: '',
        symbol: 'r^2 F_r',
        kind: 'scalar',
        value: r * r * radialFluxSpherical(derived, r),
      },
    );
    return obs;
  },

  validate(state) {
    const derived = deriveSpreading(state);
    const { wavelengthM, k, normCyl } = derived;
    const results: ValidationResult[] = [];
    const push = (id: string, description: string, residual: number, tolerance: number): void => {
      results.push({ id, description, residual, tolerance, pass: residual <= tolerance });
    };

    const r1 = 2 * wavelengthM;
    const r2 = 4 * wavelengthM;
    const at = (r: number) => spreadingFieldsAt(state, derived, r, 0);

    push(
      'spherical-halving',
      '|psi_sph(2r)| / |psi_sph(r)| = 1/2 exactly',
      Math.abs(cabs(at(r2).psiSpherical) / cabs(at(r1).psiSpherical) - 0.5),
      1e-12,
    );

    const relErrAsym = (r: number): number => {
      const f = at(r);
      const d = {
        re: f.psiCylindrical.re - f.psiCylAsymptotic.re,
        im: f.psiCylindrical.im - f.psiCylAsymptotic.im,
      };
      return Math.hypot(d.re, d.im) / cabs(f.psiCylindrical);
    };
    const rFar = 25 / k;
    push(
      'cyl-asymptote',
      'Hankel far-field asymptote within 2% for k*rho = 25',
      relErrAsym(rFar),
      0.02,
    );
    push(
      'cyl-asymptote-improves',
      'Asymptote error decreases with radius',
      relErrAsym(50 / k) < relErrAsym(rFar) ? 0 : 1,
      0,
    );

    const wronskianExact = (2 * normCyl * normCyl) / Math.PI;
    for (const [i, r] of [r1, 3.7 * wavelengthM].entries()) {
      push(
        `cyl-flux-conserved-${i}`,
        'rho * Im{psi* dpsi/drho} = 2C²/π (Bessel Wronskian)',
        Math.abs(r * radialFluxCylindrical(derived, r) - wronskianExact) / wronskianExact,
        1e-6,
      );
    }

    push(
      'sph-flux-conserved',
      'r² * radial flux is radius-independent',
      Math.abs(
        (r1 * r1 * radialFluxSpherical(derived, r1)) /
          (r2 * r2 * radialFluxSpherical(derived, r2)) -
          1,
      ),
      1e-12,
    );

    // Outgoing pin: unwrapped phase increases with radius for all radiating fields.
    const dr = wavelengthM / 50;
    let outgoingResidual = 0;
    for (const pick of ['psiCylindrical', 'psiSpherical'] as const) {
      const p1 = carg(at(r1)[pick]);
      let p2 = carg(at(r1 + dr)[pick]);
      while (p2 < p1 - Math.PI) p2 += 2 * Math.PI;
      if (p2 <= p1) outgoingResidual += 1;
    }
    push(
      'outgoing-phase',
      'Phase increases with radius (outgoing under e^{-iωt})',
      outgoingResidual + (radialFluxCylindrical(derived, r1) > 0 ? 0 : 1),
      0,
    );

    return results;
  },
};

export { defaultSpreadingState };
