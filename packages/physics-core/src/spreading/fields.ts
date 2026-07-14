import { EPSILON_0, MU_0 } from '../constants';
import { cabs, cmul, conj, cscale, expi, complex, type Complex } from '../math/complex';
import { hankel1_0, hankel1_1 } from '../math/bessel';

export interface SpreadingDerived {
  omega: number;
  /** Real wavenumber (lossless medium). */
  k: number;
  wavelengthM: number;
  phaseVelocity: number;
  periodS: number;
  /** Excluded source region radius (lambda/4): point-source expressions are singular at r = 0. */
  rhoMinM: number;
  /** Reference radius (one wavelength) where all three waves are normalized to |psi| = A. */
  refRadiusM: number;
  /** Cylindrical normalization: A / |H0(k r_ref)|. */
  normCyl: number;
  /** Spherical normalization: A * r_ref. */
  normSph: number;
}

export interface SpreadingFieldsAtPoint {
  /** Plane wave A e^{ikx}: no spreading. */
  psiPlane: Complex;
  /** Exact outgoing cylindrical wave, normCyl * H0^(1)(k rho). */
  psiCylindrical: Complex;
  /** Far-field asymptote normCyl * sqrt(2/(pi k rho)) e^{i(k rho - pi/4)}. */
  psiCylAsymptotic: Complex;
  /** Scalar spherical wave normSph * e^{ikr}/r. */
  psiSpherical: Complex;
}

export function deriveSpreading(state: {
  frequencyHz: number;
  amplitude: number;
  epsilonR: number;
  muR: number;
}): SpreadingDerived {
  const omega = 2 * Math.PI * state.frequencyHz;
  const k = omega * Math.sqrt(MU_0 * state.muR * EPSILON_0 * state.epsilonR);
  const wavelengthM = (2 * Math.PI) / k;
  const refRadiusM = wavelengthM;
  return {
    omega,
    k,
    wavelengthM,
    phaseVelocity: omega / k,
    periodS: 1 / state.frequencyHz,
    rhoMinM: wavelengthM / 4,
    refRadiusM,
    normCyl: state.amplitude / cabs(hankel1_0(k * refRadiusM)),
    normSph: state.amplitude * refRadiusM,
  };
}

const ZERO = complex(0);

/**
 * All four scalar phasors at a point in the cross-section plane. The radial
 * waves emanate from the origin; the plane wave travels along +x. Radiating
 * fields are zero inside the excluded source disk (r < rhoMinM).
 */
export function spreadingFieldsAt(
  state: { amplitude: number },
  derived: SpreadingDerived,
  x: number,
  z: number,
): SpreadingFieldsAtPoint {
  const { k, rhoMinM, normCyl, normSph } = derived;
  const r = Math.hypot(x, z);
  const psiPlane = cscale(expi(k * x), state.amplitude);
  if (r < rhoMinM) {
    return { psiPlane, psiCylindrical: ZERO, psiCylAsymptotic: ZERO, psiSpherical: ZERO };
  }
  const kr = k * r;
  const asymMag = Math.sqrt(2 / (Math.PI * kr));
  return {
    psiPlane,
    psiCylindrical: cscale(hankel1_0(kr), normCyl),
    psiCylAsymptotic: cscale(expi(kr - Math.PI / 4), normCyl * asymMag),
    psiSpherical: cscale(expi(kr), normSph / r),
  };
}

/**
 * Radial scalar flux Im{psi* d(psi)/d(rho)} for the exact cylindrical wave.
 * d/dx H0^(1)(x) = -H1^(1)(x), so the conserved quantity is
 * rho * flux = normCyl^2 * 2/pi (Bessel Wronskian) - the scalar analog of
 * power through a cylinder being computed from the fields.
 */
export function radialFluxCylindrical(derived: SpreadingDerived, rho: number): number {
  const { k, normCyl } = derived;
  const psi = cscale(hankel1_0(k * rho), normCyl);
  const dpsi = cscale(hankel1_1(k * rho), -k * normCyl);
  return cmul(conj(psi), dpsi).im;
}

/** Radial scalar flux for the spherical wave: r^2 * flux = normSph^2 * k. */
export function radialFluxSpherical(derived: SpreadingDerived, r: number): number {
  const { k, normSph } = derived;
  const mag = normSph / r;
  // psi* dpsi/dr = |psi|^2 (ik - 1/r); imaginary part is |psi|^2 k.
  return mag * mag * k;
}
