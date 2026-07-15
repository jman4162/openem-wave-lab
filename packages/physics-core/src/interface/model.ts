import { cabs, cadd, cdiv, cmul, complex, cscale, csub } from '../math/complex';
import { cnormSq } from '../math/vec3';
import type { Observable, PhysicsModel, ValidationResult } from '../model';
import { timeAveragedPoynting } from '../plane-wave/model';
import { allocFieldSample, writeFieldSample, type FieldSample } from '../sample';
import { EPSILON_0, MU_0 } from '../constants';
import { derivePlanarInterface, type InterfaceDerived } from './derive';
import { incidentFieldsAt, interfaceFieldsAt } from './fields';
import {
  defaultPlanarInterfaceState,
  planarInterfaceParameters,
  type PlanarInterfaceState,
} from './state';

export type InterfaceSample = FieldSample;

export const planarInterfaceModel: PhysicsModel<
  PlanarInterfaceState,
  InterfaceSample,
  InterfaceDerived
> = {
  id: 'planar-interface',
  fidelity: 'exact',
  assumptions: [
    'Infinite planar interface at z = 0 between homogeneous isotropic half-spaces',
    'Medium 1 (z < 0) lossless; medium 2 may be lossy or PEC',
    'Single monochromatic plane wave, incidence in the x-z plane',
    'Time-harmonic steady state, phasor convention Re{E~ e^{-iωt}}',
    'TM reflection coefficient is the Hy ratio (E-ratio texts differ by a sign)',
  ],
  parameters: planarInterfaceParameters,

  derive: derivePlanarInterface,

  sampleField(state, points, time) {
    const derived = derivePlanarInterface(state);
    const count = Math.floor(points.length / 3);
    const sample = allocFieldSample(count);
    for (let i = 0; i < count; i++) {
      const f = interfaceFieldsAt(state, derived, points[3 * i] ?? 0, points[3 * i + 2] ?? 0, time);
      writeFieldSample(sample, i, f);
    }
    return sample;
  },

  observables(state, point = { x: 0, y: 0, z: 0 }, time = 0) {
    const derived = derivePlanarInterface(state);
    const f = interfaceFieldsAt(state, derived, point.x, point.z, time);
    const Savg = timeAveragedPoynting(f.Ephasor, f.Hphasor);
    const inMedium1 = point.z < 0;
    const epsR = inMedium1 ? state.eps1R : state.eps2R;
    const muR = inMedium1 ? state.mu1R : state.mu2R;

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
        value: 0.25 * EPSILON_0 * epsR * cnormSq(f.Ephasor),
      },
      {
        id: 'u-H',
        label: 'Time-averaged magnetic energy density',
        unit: 'J/m³',
        symbol: '\\langle u_H\\rangle',
        kind: 'scalar',
        value: 0.25 * MU_0 * muR * cnormSq(f.Hphasor),
      },
    ];
    return obs;
  },

  validate(state) {
    const derived = derivePlanarInterface(state);
    const { kz1, kz2, r, t, R, T, epsilon2Complex } = derived;
    const results: ValidationResult[] = [];
    const push = (id: string, description: string, residual: number, tolerance: number): void => {
      results.push({ id, description, residual, tolerance, pass: residual <= tolerance });
    };

    const eps1 = EPSILON_0 * state.eps1R;
    const mu1 = MU_0 * state.mu1R;
    const mu2 = MU_0 * state.mu2R;

    if (state.pec) {
      // Tangential E vanishes on a PEC wall: TE Ey(0-) ∝ 1+r; TM Ex(0-) ∝ 1-r.
      const eTan =
        state.polarization === 'TE' ? cabs(cadd(complex(1), r)) : cabs(csub(complex(1), r));
      push('pec-wall', 'Tangential E vanishes at the PEC surface', eTan, 1e-12);
    } else {
      // The coefficient identities ARE the boundary conditions; a formula edit
      // that breaks either one fails here.
      push(
        'tangential-continuity-1',
        'Continuous scalar (Ey or Hy): 1 + r = t',
        cabs(csub(cadd(complex(1), r), t)),
        1e-12,
      );
      const isTE = state.polarization === 'TE';
      const lhs = cscale(csub(complex(1), r), isTE ? kz1 / mu1 : kz1 / eps1);
      const rhs = isTE ? cscale(cmul(kz2, t), 1 / mu2) : cmul(cdiv(kz2, epsilon2Complex), t);
      push(
        'tangential-continuity-2',
        isTE
          ? 'Tangential H continuous: kz1(1-r)/mu1 = kz2 t/mu2'
          : 'Tangential E continuous: kz1(1-r)/eps1 = kz2 t/eps_c2',
        cabs(csub(lhs, rhs)) / cabs(lhs),
        1e-12,
      );
    }

    // Power balance from the fields: <Sz>(0+)/<Sz_inc> + R = 1. Transmitted
    // power is computed from E x H at the boundary, never from formulas.
    const inc = incidentFieldsAt(state, derived, 0, -1e-9);
    const SzInc = timeAveragedPoynting(inc.Ephasor, inc.Hphasor).z;
    if (SzInc > 0) {
      const justInside = interfaceFieldsAt(state, derived, 0, 1e-30, 0);
      const SzTrans = state.pec
        ? 0
        : timeAveragedPoynting(justInside.Ephasor, justInside.Hphasor).z;
      push(
        'power-balance-flux',
        'R + Sz(0+)/Sz_inc = 1 (transmitted power from E x H)',
        Math.abs(R + SzTrans / SzInc - 1),
        1e-9,
      );
      push(
        'transmittance-consistency',
        'Closed-form T matches the flux ratio at z = 0+',
        state.pec ? 0 : Math.abs(SzTrans / SzInc - T),
        1e-9,
      );
    }

    push(
      'convention-kz2-branch',
      'Im(kz2) >= 0: transmitted field decays away from the interface',
      Math.max(0, -kz2.im),
      0,
    );

    if (derived.regime === 'evanescent') {
      push(
        'tir-unit-reflectance',
        '|r| = 1 under total internal reflection',
        Math.abs(cabs(r) - 1),
        1e-12,
      );
    }

    return results;
  },
};

export { defaultPlanarInterfaceState };
