import { EPSILON_0, MU_0 } from '../constants';
import { cabs, cadd, cdiv, cexp, cmul, complex, cscale, csub } from '../math/complex';
import { cnormSq } from '../math/vec3';
import type { Observable, PhysicsModel, ValidationResult } from '../model';
import { timeAveragedPoynting } from '../plane-wave/model';
import { allocFieldSample, writeFieldSample, type FieldSample } from '../sample';
import { deriveLayeredSlab, type SlabDerived } from './derive';
import { slabFieldsAt, slabIncidentFieldsAt } from './fields';
import { defaultLayeredSlabState, layeredSlabParameters, type LayeredSlabState } from './state';

export type SlabSample = FieldSample;

const epsAt = (state: LayeredSlabState, derived: SlabDerived, z: number): number =>
  z < 0 ? state.eps1R : z <= derived.thicknessM ? state.eps2R : state.eps3R;

export const layeredSlabModel: PhysicsModel<LayeredSlabState, SlabSample, SlabDerived> = {
  id: 'layered-slab',
  fidelity: 'exact',
  assumptions: [
    'Infinite planar slab occupying 0 ≤ z ≤ d between homogeneous half-spaces',
    'All three media lossless, isotropic and nonmagnetic',
    'Single monochromatic plane wave, incidence in the x-z plane',
    'Time-harmonic steady state, phasor convention Re{E~ e^{-iωt}}',
    'TM reflection coefficient is the Hy ratio (E-ratio texts differ by a sign)',
  ],
  parameters: layeredSlabParameters,

  derive: deriveLayeredSlab,

  sampleField(state, points, time) {
    const derived = deriveLayeredSlab(state);
    const count = Math.floor(points.length / 3);
    const sample = allocFieldSample(count);
    for (let i = 0; i < count; i++) {
      const f = slabFieldsAt(state, derived, points[3 * i] ?? 0, points[3 * i + 2] ?? 0, time);
      writeFieldSample(sample, i, f);
    }
    return sample;
  },

  observables(state, point = { x: 0, y: 0, z: 0 }, time = 0) {
    const derived = deriveLayeredSlab(state);
    const f = slabFieldsAt(state, derived, point.x, point.z, time);
    const epsR = epsAt(state, derived, point.z);
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
        value: timeAveragedPoynting(f.Ephasor, f.Hphasor),
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
        value: 0.25 * MU_0 * cnormSq(f.Hphasor),
      },
    ];
    return obs;
  },

  validate(state) {
    const derived = deriveLayeredSlab(state);
    const { kz1, kz2, kz3, r, t, A, B, R, T, thicknessM } = derived;
    const results: ValidationResult[] = [];
    const push = (id: string, description: string, residual: number, tolerance: number): void => {
      results.push({ id, description, residual, tolerance, pass: residual <= tolerance });
    };

    // The four coefficient identities ARE the boundary conditions at both faces.
    const isTE = state.polarization === 'TE';
    const q1 = complex(isTE ? kz1 : kz1 / state.eps1R);
    const q2 = isTE ? kz2 : cscale(kz2, 1 / state.eps2R);
    const q3 = isTE ? kz3 : cscale(kz3, 1 / state.eps3R);
    const phase = cexp(complex(-kz2.im * thicknessM, kz2.re * thicknessM)); // e^{i kz2 d}
    const fwdD = cmul(A, phase);
    const bwdD = cdiv(B, phase);
    const rel = (a: number, scale: number): number => a / Math.max(scale, 1e-300);

    const lhs0 = cadd(complex(1), r);
    push(
      'continuity-scalar-z0',
      'z = 0: continuous scalar (Ey or Hy), 1 + r = A + B',
      rel(cabs(csub(lhs0, cadd(A, B))), 1 + cabs(r)),
      1e-12,
    );
    const flux0 = cmul(q1, csub(complex(1), r));
    push(
      'continuity-derivative-z0',
      isTE
        ? 'z = 0: tangential H continuous, kz1(1 - r) = kz2(A - B)'
        : 'z = 0: tangential E continuous, kz1(1 - r)/eps1 = kz2(A - B)/eps2',
      rel(cabs(csub(flux0, cmul(q2, csub(A, B)))), cabs(flux0) + cabs(q1)),
      1e-12,
    );
    push(
      'continuity-scalar-zd',
      'z = d: continuous scalar, A e^{i kz2 d} + B e^{-i kz2 d} = t',
      rel(cabs(csub(cadd(fwdD, bwdD), t)), cabs(fwdD) + cabs(bwdD) + cabs(t)),
      1e-12,
    );
    push(
      'continuity-derivative-zd',
      'z = d: derivative condition, q2(A e^{i kz2 d} - B e^{-i kz2 d}) = q3 t',
      rel(
        cabs(csub(cmul(q2, csub(fwdD, bwdD)), cmul(q3, t))),
        cabs(q2) * (cabs(fwdD) + cabs(bwdD)) + cabs(q3) * cabs(t),
      ),
      1e-12,
    );

    // Power balance from E x H: incident flux, flux through the slab middle,
    // and flux leaving the far face. Lossless media conserve all three.
    const inc = slabIncidentFieldsAt(state, derived, 0, -1e-9);
    const SzInc = timeAveragedPoynting(inc.Ephasor, inc.Hphasor).z;
    if (SzInc > 0) {
      const beyond = slabFieldsAt(state, derived, 0, thicknessM * (1 + 1e-12) + 1e-30, 0);
      const SzOut = timeAveragedPoynting(beyond.Ephasor, beyond.Hphasor).z / SzInc;
      push(
        'power-balance-flux',
        'R + Sz(d+)/Sz_inc = 1 (transmitted power from E x H)',
        Math.abs(R + SzOut - 1),
        1e-9,
      );
      push(
        'transmittance-consistency',
        'Closed-form T matches the flux ratio at z = d+',
        Math.abs(SzOut - T),
        1e-9,
      );
      const middle = slabFieldsAt(state, derived, 0, 0.5 * thicknessM, 0);
      const SzMid = timeAveragedPoynting(middle.Ephasor, middle.Hphasor).z / SzInc;
      push(
        'flux-through-slab',
        'Sz inside the slab equals the transmitted flux (no loss, even when evanescent)',
        Math.abs(SzMid - SzOut),
        1e-9,
      );
    }

    // Thin-slab limit: the Airy sum at d = 0 must be the single 1 -> 3 interface.
    const r13 = cdiv(csub(q1, q3), cadd(q1, q3));
    const rZero = deriveLayeredSlab({ ...state, thicknessLambda1: 0 }).r;
    push(
      'thin-slab-limit',
      'd → 0 reduces to the single interface 1 → 3',
      cabs(csub(rZero, r13)),
      1e-12,
    );

    push(
      'convention-kz-branch',
      'Im(kz2), Im(kz3) >= 0: evanescent fields decay away from their source',
      Math.max(0, -kz2.im, -kz3.im),
      0,
    );

    if (derived.exitRegime === 'evanescent') {
      push(
        'exit-tir-unit-reflectance',
        '|r| = 1 when medium 3 is beyond its critical angle',
        Math.abs(cabs(r) - 1),
        1e-12,
      );
    }

    return results;
  },
};

export { defaultLayeredSlabState };
