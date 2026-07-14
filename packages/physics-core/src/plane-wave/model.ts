import { EPSILON_0, MU_0 } from '../constants';
import { cabs, cdiv } from '../math/complex';
import {
  ccross,
  cconjVec,
  cdotUnconjugated,
  cnormSq,
  cross,
  norm,
  type ComplexVec3,
  type Vec3,
} from '../math/vec3';
import type { Observable, PhysicsModel, ValidationResult } from '../model';
import { derivePlaneWave, type PlaneWaveDerived } from './derive';
import { fieldsAt } from './fields';
import { defaultPlaneWaveState, planeWaveParameters, type PlaneWaveState } from './state';

export interface PlaneWaveSample {
  count: number;
  /** Instantaneous E, xyz-interleaved (3N), V/m. */
  E: Float32Array;
  /** Instantaneous H, xyz-interleaved (3N), A/m. */
  H: Float32Array;
  /** Phasor E~, re/im interleaved per component (6N). */
  Ephasor: Float32Array;
  /** Phasor H~, re/im interleaved per component (6N). */
  Hphasor: Float32Array;
}

/** Time-averaged Poynting vector <S> = (1/2) Re{E~ x H~*}, W/m^2. */
export function timeAveragedPoynting(Ephasor: ComplexVec3, Hphasor: ComplexVec3): Vec3 {
  const s = ccross(Ephasor, cconjVec(Hphasor));
  return { x: 0.5 * s.x.re, y: 0.5 * s.y.re, z: 0.5 * s.z.re };
}

const writeComplexVec = (out: Float32Array, i: number, v: ComplexVec3): void => {
  out[6 * i] = v.x.re;
  out[6 * i + 1] = v.x.im;
  out[6 * i + 2] = v.y.re;
  out[6 * i + 3] = v.y.im;
  out[6 * i + 4] = v.z.re;
  out[6 * i + 5] = v.z.im;
};

export const planeWaveModel: PhysicsModel<PlaneWaveState, PlaneWaveSample, PlaneWaveDerived> = {
  id: 'plane-wave',
  fidelity: 'exact',
  assumptions: [
    'Infinite homogeneous isotropic linear medium',
    'Time-harmonic steady state, phasor convention Re{E~ e^{-iωt}}',
    'Uniform plane wave propagating along +z; E in the xy-plane',
    'Material parameters constant with frequency (no dispersion)',
  ],
  parameters: planeWaveParameters,

  derive: derivePlaneWave,

  sampleField(state, points, time) {
    const derived = derivePlaneWave(state);
    const count = Math.floor(points.length / 3);
    const sample: PlaneWaveSample = {
      count,
      E: new Float32Array(3 * count),
      H: new Float32Array(3 * count),
      Ephasor: new Float32Array(6 * count),
      Hphasor: new Float32Array(6 * count),
    };
    for (let i = 0; i < count; i++) {
      const z = points[3 * i + 2] ?? 0;
      const f = fieldsAt(state, derived, z, time);
      sample.E[3 * i] = f.E.x;
      sample.E[3 * i + 1] = f.E.y;
      sample.E[3 * i + 2] = f.E.z;
      sample.H[3 * i] = f.H.x;
      sample.H[3 * i + 1] = f.H.y;
      sample.H[3 * i + 2] = f.H.z;
      writeComplexVec(sample.Ephasor, i, f.Ephasor);
      writeComplexVec(sample.Hphasor, i, f.Hphasor);
    }
    return sample;
  },

  observables(state, point = { x: 0, y: 0, z: 0 }, time = 0) {
    const derived = derivePlaneWave(state);
    const f = fieldsAt(state, derived, point.z, time);
    const Savg = timeAveragedPoynting(f.Ephasor, f.Hphasor);
    const Sinst = cross(f.E, f.H);
    // Time-averaged energy densities from phasor magnitudes.
    const uE = 0.25 * EPSILON_0 * state.epsilonR * cnormSq(f.Ephasor);
    const uH = 0.25 * MU_0 * state.muR * cnormSq(f.Hphasor);

    const obs: Observable[] = [
      {
        id: 'E-phasor',
        label: 'Electric field phasor',
        unit: 'V/m',
        symbol: '\\tilde{\\mathbf{E}}',
        kind: 'complex-vec3',
        value: f.Ephasor,
      },
      {
        id: 'H-phasor',
        label: 'Magnetic field phasor',
        unit: 'A/m',
        symbol: '\\tilde{\\mathbf{H}}',
        kind: 'complex-vec3',
        value: f.Hphasor,
      },
      {
        id: 'E-inst',
        label: 'Instantaneous electric field',
        unit: 'V/m',
        symbol: '\\mathbf{E}(t)',
        kind: 'vec3',
        value: f.E,
      },
      {
        id: 'H-inst',
        label: 'Instantaneous magnetic field',
        unit: 'A/m',
        symbol: '\\mathbf{H}(t)',
        kind: 'vec3',
        value: f.H,
      },
      {
        id: 'eta',
        label: 'Intrinsic impedance',
        unit: 'Ω',
        symbol: '\\eta',
        kind: 'complex',
        value: derived.eta,
      },
      {
        id: 'S-inst',
        label: 'Instantaneous Poynting vector',
        unit: 'W/m²',
        symbol: '\\mathbf{S}(t)',
        kind: 'vec3',
        value: Sinst,
      },
      {
        id: 'S-avg',
        label: 'Time-averaged Poynting vector',
        unit: 'W/m²',
        symbol: '\\langle\\mathbf{S}\\rangle',
        kind: 'vec3',
        value: Savg,
      },
      {
        id: 'u-E',
        label: 'Time-averaged electric energy density',
        unit: 'J/m³',
        symbol: '\\langle u_E\\rangle',
        kind: 'scalar',
        value: uE,
      },
      {
        id: 'u-H',
        label: 'Time-averaged magnetic energy density',
        unit: 'J/m³',
        symbol: '\\langle u_H\\rangle',
        kind: 'scalar',
        value: uH,
      },
    ];
    return obs;
  },

  validate(state) {
    const derived = derivePlaneWave(state);
    const f = fieldsAt(state, derived, 0.3 * derived.wavelengthM, 0);
    const results: ValidationResult[] = [];
    const push = (id: string, description: string, residual: number, tolerance: number): void => {
      results.push({ id, description, residual, tolerance, pass: residual <= tolerance });
    };

    const eNorm = Math.sqrt(cnormSq(f.Ephasor));
    const hNorm = Math.sqrt(cnormSq(f.Hphasor));
    if (eNorm > 0 && hNorm > 0) {
      push(
        'phasor-orthogonality',
        'E~ . H~ = 0 (phasor orthogonality)',
        cabs(cdotUnconjugated(f.Ephasor, f.Hphasor)) / (eNorm * hNorm),
        1e-12,
      );
      push(
        'transversality',
        'E and H have no z-component',
        (cabs(f.Ephasor.z) + cabs(f.Hphasor.z)) / (eNorm + hNorm),
        1e-12,
      );
    }

    if (state.E0x > 0) {
      const ratio = cabs(cdiv(f.Ephasor.x, f.Hphasor.y));
      push(
        'impedance',
        '|E~x / H~y| equals |eta|',
        Math.abs(ratio - cabs(derived.eta)) / cabs(derived.eta),
        1e-12,
      );
    }

    const Savg = timeAveragedPoynting(f.Ephasor, f.Hphasor);
    const SavgNorm = norm(Savg);
    if (SavgNorm > 0) {
      push(
        'poynting-direction',
        '<S> from (1/2)Re{E~ x H~*} points along +z',
        Math.hypot(Savg.x, Savg.y) / SavgNorm + (Savg.z < 0 ? 1 : 0),
        1e-12,
      );
    }

    push(
      'convention-passivity',
      'Im(eps_c) >= 0 and alpha >= 0 under Re{e^{-iωt}}',
      Math.max(0, -derived.epsilonComplex.im) + Math.max(0, -derived.alpha),
      0,
    );

    return results;
  },
};

export { defaultPlaneWaveState };
