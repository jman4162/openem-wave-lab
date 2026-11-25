import { EPSILON_0, MU_0 } from '../constants';
import { cadd, cdiv, cexp, cmul, complex, cscale, csub, expi, type Complex } from '../math/complex';
import type { ComplexVec3, Vec3 } from '../math/vec3';
import type { SlabDerived } from './derive';
import type { LayeredSlabState } from './state';

export interface SlabFieldsAtPoint {
  Ephasor: ComplexVec3;
  Hphasor: ComplexVec3;
  E: Vec3;
  H: Vec3;
}

const ZERO = complex(0);

const instantaneous = (phasor: Complex, phase: Complex): number =>
  phasor.re * phase.re - phasor.im * phase.im;

/** e^{i k z} for complex k and real z. */
const propagate = (k: Complex, z: number): Complex => cexp(complex(-k.im * z, k.re * z));

/**
 * Piecewise total fields under Re{ . e^{-i omega t}}, written for the
 * continuous scalar psi (Ey for TE, Hy/H0 for TM, H0 = E0/eta1):
 *
 *   z < 0:      psi = e^{ikx x}(e^{i kz1 z} + r e^{-i kz1 z})
 *   0 <= z <= d: psi = e^{ikx x}(A e^{i kz2 z} + B e^{-i kz2 z})
 *   z > d:      psi = e^{ikx x} t e^{i kz3 (z - d)}
 *
 * The other components follow from the curl equations exactly as in the
 * planar-interface model: curl E = i omega mu H, curl H = -i omega eps E.
 */
export function slabFieldsAt(
  state: LayeredSlabState,
  derived: SlabDerived,
  x: number,
  z: number,
  t: number,
): SlabFieldsAtPoint {
  const { omega, kx, kz1, kz2, kz3, r, t: tc, A, B, thicknessM } = derived;
  const xPhase = expi(kx * x);

  let psi: Complex;
  let dzPsi: Complex;
  let epsR: number;
  if (z < 0) {
    const up = expi(kz1 * z);
    const down = expi(-kz1 * z);
    psi = cmul(xPhase, cadd(up, cmul(r, down)));
    dzPsi = cmul(xPhase, cmul(complex(0, kz1), csub(up, cmul(r, down))));
    epsR = state.eps1R;
  } else if (z <= thicknessM) {
    const fwd = cmul(A, propagate(kz2, z));
    const bwd = cmul(B, propagate(cscale(kz2, -1), z));
    psi = cmul(xPhase, cadd(fwd, bwd));
    dzPsi = cmul(xPhase, cmul(cmul(complex(0, 1), kz2), csub(fwd, bwd)));
    epsR = state.eps2R;
  } else {
    psi = cmul(xPhase, cmul(tc, propagate(kz3, z - thicknessM)));
    dzPsi = cmul(cmul(complex(0, 1), kz3), psi);
    epsR = state.eps3R;
  }
  const dxPsi = cmul(complex(0, kx), psi);

  let Ephasor: ComplexVec3;
  let Hphasor: ComplexVec3;
  if (state.polarization === 'TE') {
    const Ey = cscale(psi, state.E0);
    const iOmegaMu = complex(0, omega * MU_0);
    Ephasor = { x: ZERO, y: Ey, z: ZERO };
    Hphasor = {
      x: cdiv(cscale(dzPsi, -state.E0), iOmegaMu),
      y: ZERO,
      z: cdiv(cscale(dxPsi, state.E0), iOmegaMu),
    };
  } else {
    const H0 = state.E0 / derived.eta1;
    const iOverOmegaEps = complex(0, 1 / (omega * EPSILON_0 * epsR));
    Ephasor = {
      x: cmul(iOverOmegaEps, cscale(dzPsi, -H0)),
      y: ZERO,
      z: cmul(iOverOmegaEps, cscale(dxPsi, H0)),
    };
    Hphasor = { x: ZERO, y: cscale(psi, H0), z: ZERO };
  }

  const timePhase = expi(-omega * t);
  return {
    Ephasor,
    Hphasor,
    E: {
      x: instantaneous(Ephasor.x, timePhase),
      y: instantaneous(Ephasor.y, timePhase),
      z: instantaneous(Ephasor.z, timePhase),
    },
    H: {
      x: instantaneous(Hphasor.x, timePhase),
      y: instantaneous(Hphasor.y, timePhase),
      z: instantaneous(Hphasor.z, timePhase),
    },
  };
}

/** Incident-only phasor fields in medium 1 (r = 0), for flux normalization. */
export function slabIncidentFieldsAt(
  state: LayeredSlabState,
  derived: SlabDerived,
  x: number,
  z: number,
): { Ephasor: ComplexVec3; Hphasor: ComplexVec3 } {
  const f = slabFieldsAt(state, { ...derived, r: ZERO }, x, Math.min(z, -1e-15), 0);
  return { Ephasor: f.Ephasor, Hphasor: f.Hphasor };
}
