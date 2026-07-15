import { EPSILON_0, MU_0 } from '../constants';
import { cadd, cdiv, cexp, cmul, complex, cscale, csub, expi, type Complex } from '../math/complex';
import type { ComplexVec3, Vec3 } from '../math/vec3';
import type { InterfaceDerived } from './derive';
import type { PlanarInterfaceState } from './state';

export interface InterfaceFieldsAtPoint {
  Ephasor: ComplexVec3;
  Hphasor: ComplexVec3;
  E: Vec3;
  H: Vec3;
}

const ZERO = complex(0);

const instantaneous = (phasor: Complex, phase: Complex): number =>
  phasor.re * phase.re - phasor.im * phase.im;

/**
 * Piecewise total fields under Re{ . e^{-i omega t}}.
 *
 * TE (E = Ey y^):
 *   z<0: Ey = E0 e^{ikx x}(e^{i kz1 z} + r e^{-i kz1 z})
 *   z>0: Ey = E0 t e^{ikx x} e^{i kz2 z}
 *   H = (1/(i omega mu)) curl E  =>  Hx = -dz(Ey)/(i omega mu), Hz = dx(Ey)/(i omega mu)
 *
 * TM (H = Hy y^, H0 = E0/eta1):
 *   Hy has the same structure; E = (i/(omega eps_c)) curl H  =>
 *   Ex = -i dz(Hy)/(omega eps_c) * i ... written out:
 *   Ex = (i/(omega eps_c)) (-dz Hy),  Ez = (i/(omega eps_c)) (dx Hy)
 *
 * Maxwell curls under e^{-i omega t}: curl E = +i omega mu H, curl H = -i omega eps_c E.
 */
export function interfaceFieldsAt(
  state: PlanarInterfaceState,
  derived: InterfaceDerived,
  x: number,
  z: number,
  t: number,
): InterfaceFieldsAtPoint {
  const { omega, kx, kz1, kz2, r, t: tc, epsilon2Complex } = derived;
  const inMedium1 = z < 0;

  const xPhase = expi(kx * x);
  const eps1 = complex(EPSILON_0 * state.eps1R);
  const mu1 = MU_0 * state.mu1R;
  const mu2 = MU_0 * state.mu2R;

  // Scalar field psi (Ey for TE, Hy for TM) and its z-derivative factor.
  let psi: Complex;
  let dzPsi: Complex;
  if (inMedium1) {
    const up = expi(kz1 * z); // incident, +z-going
    const down = expi(-kz1 * z); // reflected
    psi = cmul(xPhase, cadd(up, cmul(r, down)));
    dzPsi = cmul(xPhase, cmul(complex(0, kz1), csub(up, cmul(r, down))));
  } else if (state.pec) {
    psi = ZERO;
    dzPsi = ZERO;
  } else {
    // e^{i kz2 z} with complex kz2 = b + ia: e^{-a z} e^{i b z}
    const prop = cexp(complex(-kz2.im * z, kz2.re * z));
    psi = cmul(xPhase, cmul(tc, prop));
    dzPsi = cmul(cmul(complex(0, 1), kz2), psi);
  }
  const dxPsi = cmul(complex(0, kx), psi);

  let Ephasor: ComplexVec3;
  let Hphasor: ComplexVec3;
  if (state.polarization === 'TE') {
    const Ey = cscale(psi, state.E0);
    const dzEy = cscale(dzPsi, state.E0);
    const dxEy = cscale(dxPsi, state.E0);
    const iOmegaMu = complex(0, omega * (inMedium1 ? mu1 : mu2));
    Ephasor = { x: ZERO, y: Ey, z: ZERO };
    Hphasor = {
      x: cdiv(cscale(dzEy, -1), iOmegaMu),
      y: ZERO,
      z: cdiv(dxEy, iOmegaMu),
    };
  } else {
    const H0 = state.E0 / derived.eta1;
    const Hy = cscale(psi, H0);
    const dzHy = cscale(dzPsi, H0);
    const dxHy = cscale(dxPsi, H0);
    // E = (i/(omega eps_c)) curl H, curl(0,Hy,0) = (-dz Hy, 0, dx Hy)
    const iOverOmegaEps = cdiv(complex(0, 1 / omega), inMedium1 ? eps1 : epsilon2Complex);
    Ephasor = {
      x: cmul(iOverOmegaEps, cscale(dzHy, -1)),
      y: ZERO,
      z: cmul(iOverOmegaEps, dxHy),
    };
    Hphasor = { x: ZERO, y: Hy, z: ZERO };
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

/** Incident-only phasor fields (r = 0 branch of medium 1), for flux normalization. */
export function incidentFieldsAt(
  state: PlanarInterfaceState,
  derived: InterfaceDerived,
  x: number,
  z: number,
): { Ephasor: ComplexVec3; Hphasor: ComplexVec3 } {
  const noReflection: InterfaceDerived = { ...derived, r: complex(0), t: complex(1) };
  const zInMedium1 = Math.min(z, -1e-15);
  const f = interfaceFieldsAt({ ...state, pec: false }, noReflection, x, zInMedium1, 0);
  return { Ephasor: f.Ephasor, Hphasor: f.Hphasor };
}
