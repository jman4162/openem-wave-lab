import { EPSILON_0, MU_0 } from '../constants';
import { cabs, cadd, cdiv, cexp, cmul, complex, cscale, csub, type Complex } from '../math/complex';
import type { LayeredSlabState } from './state';

export type SlabLayerRegime = 'propagating' | 'evanescent';

export interface SlabDerived {
  omega: number;
  /** Free-space wavenumber. */
  k0: number;
  /** Medium-1 wavenumber (real; medium 1 is lossless). */
  k1: number;
  wavelength1M: number;
  periodS: number;
  /** Tangential wavenumber kx = k1 sin(theta), the same in all three media (Snell). */
  kx: number;
  /** Normal wavenumber in medium 1, real >= 0. */
  kz1: number;
  /** Normal wavenumbers in the slab and medium 3, branch Im >= 0 (evanescent fields decay). */
  kz2: Complex;
  kz3: Complex;
  thicknessM: number;
  /**
   * Interface reflection coefficients of the continuous scalar (Ey for TE, Hy
   * for TM): r_jk = (q_j - q_k)/(q_j + q_k) with q = kz (TE) or kz/eps_r (TM).
   */
  r12: Complex;
  r23: Complex;
  /** Slab reflection coefficient (Airy sum), same scalar convention as the planar-interface model. */
  r: Complex;
  /** Transmitted scalar amplitude at z = d+, relative to the incident amplitude at z = 0. */
  t: Complex;
  /** Forward and backward scalar amplitudes inside the slab: psi = A e^{i kz2 z} + B e^{-i kz2 z}. */
  A: Complex;
  B: Complex;
  R: number;
  /** Power transmittance from the closed-form flux ratio (cross-checked against E x H). */
  T: number;
  slabRegime: SlabLayerRegime;
  exitRegime: SlabLayerRegime;
  /** 1/Im(kz2) when the slab field is evanescent (frustrated TIR), else null. */
  slabDecayLengthM: number | null;
  /** Thickness step between reflection zeros, pi/Re(kz2), in lambda_1; null if the slab is evanescent. */
  halfWaveStepLambda1: number | null;
  /** Airy peak reflectance 4|r12|^2/(1+|r12|^2)^2 for a symmetric propagating slab, else null. */
  airyMaxReflectance: number | null;
  /** Medium-1 intrinsic impedance (real). */
  eta1: number;
}

/**
 * kz = sqrt(k0^2 eps_r - kx^2) for a lossless medium: purely real (propagating)
 * or purely imaginary with Im > 0 (evanescent). Taking the two cases
 * separately avoids the ~1e-16 round-off component csqrt leaves on the axis.
 */
const normalWavenumber = (k0: number, epsR: number, kx: number): Complex => {
  const kzSq = k0 * k0 * epsR - kx * kx;
  return kzSq >= 0 ? complex(Math.sqrt(kzSq)) : complex(0, Math.sqrt(-kzSq));
};

/** e^{i a} for complex a. */
const expiComplex = (a: Complex): Complex => cexp(complex(-a.im, a.re));

export function deriveLayeredSlab(state: LayeredSlabState): SlabDerived {
  const omega = 2 * Math.PI * state.frequencyHz;
  const k0 = omega * Math.sqrt(MU_0 * EPSILON_0);
  const k1 = k0 * Math.sqrt(state.eps1R);
  const theta = (state.thetaDeg * Math.PI) / 180;
  const kx = k1 * Math.sin(theta);
  const kz1 = k1 * Math.cos(theta);
  const wavelength1M = (2 * Math.PI) / k1;
  const thicknessM = state.thicknessLambda1 * wavelength1M;

  let kz2 = normalWavenumber(k0, state.eps2R, kx);
  // kz2 = 0 exactly (grazing in the slab) makes q3/q2 singular; the physical
  // limit is continuous, so step off it by a negligible amount.
  if (cabs(kz2) < 1e-9 * k0) kz2 = complex(1e-9 * k0);
  const kz3 = normalWavenumber(k0, state.eps3R, kx);

  const isTE = state.polarization === 'TE';
  const q1 = complex(isTE ? kz1 : kz1 / state.eps1R);
  const q2 = isTE ? kz2 : cscale(kz2, 1 / state.eps2R);
  const q3 = isTE ? kz3 : cscale(kz3, 1 / state.eps3R);

  const r12 = cdiv(csub(q1, q2), cadd(q1, q2));
  const r23 = cdiv(csub(q2, q3), cadd(q2, q3));
  const t12 = cadd(complex(1), r12);
  const t23 = cadd(complex(1), r23);

  // Airy sum of the multiple reflections, with delta = kz2 d.
  const phase = expiComplex(cscale(kz2, thicknessM)); // e^{i delta}
  const phase2 = cmul(phase, phase); // e^{2 i delta}
  const den = cadd(complex(1), cmul(cmul(r12, r23), phase2));
  const r = cdiv(cadd(r12, cmul(r23, phase2)), den);
  const t = cdiv(cmul(cmul(t12, t23), phase), den);

  // Slab amplitudes from the exit face. For an evanescent slab this keeps B
  // (the growing-wave amplitude, ~e^{-2 kappa d}) accurate instead of
  // obtaining it by cancellation at the entrance face.
  const q3OverQ2 = cdiv(q3, q2);
  const A = cdiv(cscale(cmul(t, cadd(complex(1), q3OverQ2)), 0.5), phase);
  const B = cscale(cmul(cmul(t, csub(complex(1), q3OverQ2)), phase), 0.5);

  const R = cabs(r) ** 2;
  const T = q1.re > 0 ? (q3.re / q1.re) * cabs(t) ** 2 : 0;

  const slabRegime: SlabLayerRegime = kz2.im > 1e-9 * k0 ? 'evanescent' : 'propagating';
  const exitRegime: SlabLayerRegime = kz3.im > 1e-9 * k0 ? 'evanescent' : 'propagating';
  const symmetric = Math.abs(state.eps1R - state.eps3R) < 1e-12;
  const r12Abs2 = cabs(r12) ** 2;

  return {
    omega,
    k0,
    k1,
    wavelength1M,
    periodS: 1 / state.frequencyHz,
    kx,
    kz1,
    kz2,
    kz3,
    thicknessM,
    r12,
    r23,
    r,
    t,
    A,
    B,
    R,
    T,
    slabRegime,
    exitRegime,
    slabDecayLengthM: slabRegime === 'evanescent' ? 1 / kz2.im : null,
    halfWaveStepLambda1: slabRegime === 'propagating' ? Math.PI / kz2.re / wavelength1M : null,
    airyMaxReflectance:
      symmetric && slabRegime === 'propagating' && exitRegime === 'propagating'
        ? (4 * r12Abs2) / (1 + r12Abs2) ** 2
        : null,
    eta1: Math.sqrt(MU_0 / (EPSILON_0 * state.eps1R)),
  };
}
