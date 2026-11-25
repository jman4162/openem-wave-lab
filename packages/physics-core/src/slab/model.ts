import { EPSILON_0, MU_0 } from '../constants';
import { cabs, cadd, cdiv, complex, cscale, csub } from '../math/complex';
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
    const { kz1, kz2, kz3, r, R, T, thicknessM } = derived;
    const results: ValidationResult[] = [];
    const push = (id: string, description: string, residual: number, tolerance: number): void => {
      results.push({ id, description, residual, tolerance, pass: residual <= tolerance });
    };

    // Boundary conditions from the fields themselves, evaluated just either side
    // of each face: the continuous scalar (Ey or Hy) and the other tangential
    // field (Hx for TE, Ex for TM). This exercises the same code the renderer uses.
    const isTE = state.polarization === 'TE';
    const inc0 = slabIncidentFieldsAt(state, derived, 0, -1e-9);
    const scalarScale = isTE ? cabs(inc0.Ephasor.y) : cabs(inc0.Hphasor.y);
    const tangentScale = Math.max(isTE ? cabs(inc0.Hphasor.x) : cabs(inc0.Ephasor.x), 1e-300);
    const gap = 1e-12 * derived.wavelength1M;
    for (const [label, zFace] of [
      ['z0', 0],
      ['zd', thicknessM],
    ] as const) {
      const below = slabFieldsAt(state, derived, 0.3 * derived.wavelength1M, zFace - gap, 0);
      const above = slabFieldsAt(state, derived, 0.3 * derived.wavelength1M, zFace + gap, 0);
      const dScalar = isTE
        ? csub(below.Ephasor.y, above.Ephasor.y)
        : csub(below.Hphasor.y, above.Hphasor.y);
      const dTangent = isTE
        ? csub(below.Hphasor.x, above.Hphasor.x)
        : csub(below.Ephasor.x, above.Ephasor.x);
      const where = label === 'z0' ? 'z = 0' : 'z = d';
      push(
        `continuity-scalar-${label}`,
        `${where}: ${isTE ? 'Ey' : 'Hy'} continuous`,
        cabs(dScalar) / scalarScale,
        1e-9,
      );
      push(
        `continuity-tangential-${label}`,
        `${where}: ${isTE ? 'Hx' : 'Ex'} continuous`,
        cabs(dTangent) / tangentScale,
        1e-9,
      );
    }

    // Power balance from E x H: incident flux, flux through the slab middle,
    // and flux leaving the far face. Lossless media conserve all three.
    const SzInc = timeAveragedPoynting(inc0.Ephasor, inc0.Hphasor).z;
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

    // Thin-slab limit: d = 0 must reproduce the single 1 -> 3 interface.
    const q1 = complex(isTE ? kz1 : kz1 / state.eps1R);
    const q3 = isTE ? kz3 : cscale(kz3, 1 / state.eps3R);
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
