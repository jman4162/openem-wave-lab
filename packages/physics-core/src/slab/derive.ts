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
  /**
   * True when |kz2| d < 0.01, i.e. the slab is at or near its critical angle.
   * There the slab field uses the cos/sinc (characteristic-matrix) basis,
   * which has no singularity at kz2 = 0; elsewhere it uses A and B.
   */
  nearCritical: boolean;
  /**
   * Forward and backward scalar amplitudes inside the slab, psi = A e^{i kz2 z} + B e^{-i kz2 z}.
   * Valid only when nearCritical is false (set to 0 otherwise).
   */
  A: Complex;
  B: Complex;
  /** Slab field data for the cos/sinc basis: psi(0+) = 1 + r and u0 = (d psi/dz)/p2 at z = 0+. */
  psi0: Complex;
  u0: Complex;
  /** kz2^2 = k0^2 eps_r2 - kx^2 (real: the slab is lossless). */
  kz2Squared: number;
  /** p2 = 1 (TE) or eps_r2 (TM): the weight in the continuous normal-derivative condition. */
  p2: number;
  R: number;
  /** Power transmittance from the closed-form flux ratio (cross-checked against E x H). */
  T: number;
  slabRegime: SlabLayerRegime;
  exitRegime: SlabLayerRegime;
  /** 1/Im(kz2) when the slab field is evanescent (frustrated TIR), else null. */
  slabDecayLengthM: number | null;
  /**
   * Thickness period of R(d), pi/Re(kz2), in lambda_1, when the slab and medium 3 both propagate
   * (null otherwise). For a symmetric slab R = 0 at every multiple of it.
   */
  reflectancePeriodLambda1: number | null;
  /** Lateral shift d kx / Re(kz2) of a ray crossing a propagating slab (0 if evanescent). */
  rayExitOffsetM: number;
  /**
   * Airy peak reflectance 4|r12|^2/(1+|r12|^2)^2 for a symmetric slab when R(d) is periodic
   * (reflectancePeriodLambda1 not null), else null.
   */
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

/**
 * [cos(kz z), sin(kz z)/kz] for real kz^2 (a lossless layer): trigonometric when
 * kz^2 > 0, hyperbolic when kz^2 < 0, and [1, z] at kz = 0. Both are entire
 * functions of kz^2, so this basis is regular through the critical angle.
 */
export function slabCosSinc(kzSquared: number, z: number): [number, number] {
  if (kzSquared > 0) {
    const k = Math.sqrt(kzSquared);
    return [Math.cos(k * z), Math.sin(k * z) / k];
  }
  if (kzSquared < 0) {
    const kappa = Math.sqrt(-kzSquared);
    return [Math.cosh(kappa * z), Math.sinh(kappa * z) / kappa];
  }
  return [1, z];
}

export function deriveLayeredSlab(state: LayeredSlabState): SlabDerived {
  const omega = 2 * Math.PI * state.frequencyHz;
  const k0 = omega * Math.sqrt(MU_0 * EPSILON_0);
  const k1 = k0 * Math.sqrt(state.eps1R);
  const theta = (state.thetaDeg * Math.PI) / 180;
  const kx = k1 * Math.sin(theta);
  const kz1 = k1 * Math.cos(theta);
  const wavelength1M = (2 * Math.PI) / k1;
  const thicknessM = state.thicknessLambda1 * wavelength1M;

  const kz2 = normalWavenumber(k0, state.eps2R, kx);
  const kz2Squared = k0 * k0 * state.eps2R - kx * kx;
  const kz3 = normalWavenumber(k0, state.eps3R, kx);

  const isTE = state.polarization === 'TE';
  const p2 = isTE ? 1 : state.eps2R;
  const q1 = complex(isTE ? kz1 : kz1 / state.eps1R);
  const q2 = isTE ? kz2 : cscale(kz2, 1 / state.eps2R);
  const q3 = isTE ? kz3 : cscale(kz3, 1 / state.eps3R);

  const r12 = cdiv(csub(q1, q2), cadd(q1, q2));
  const r23 = cdiv(csub(q2, q3), cadd(q2, q3));
  const t12 = cadd(complex(1), r12);
  const t23 = cadd(complex(1), r23);

  // Two exact forms of the same solution, each used where it is well conditioned.
  // Near the slab's critical angle (|kz2| d small) the Airy denominator
  // 1 + r12 r23 e^{2i delta} -> 0 and A, B ~ 1/kz2 cancel, so use the
  // characteristic matrix in the cos/sinc basis instead. Away from it, keep the
  // Airy form: for a thick evanescent slab it stays accurate where the matrix
  // form would subtract numbers of size e^{kappa d}.
  const nearCritical = cabs(kz2) * thicknessM < 0.01;
  let r: Complex;
  let t: Complex;
  let A = complex(0);
  let B = complex(0);
  if (nearCritical) {
    // [psi; u](d) = [[c, p2 S], [-(kz2^2/p2) S, c]] [psi; u](0), with u = psi'/p,
    // psi(0) = 1 + r, u(0) = i q1 (1 - r), psi(d) = t, u(d) = i q3 t.
    const [c, S] = slabCosSinc(kz2Squared, thicknessM);
    const X = cadd(cscale(cmul(complex(0, 1), q3), c), complex((kz2Squared / p2) * S));
    const Y = cadd(cscale(cmul(complex(0, 1), q1), c), cscale(cmul(q1, q3), p2 * S));
    r = cdiv(csub(Y, X), cadd(Y, X));
    t = cadd(
      cscale(cadd(complex(1), r), c),
      cscale(cmul(cmul(complex(0, 1), q1), csub(complex(1), r)), p2 * S),
    );
  } else {
    // Airy sum of the multiple reflections, with delta = kz2 d.
    const phase = expiComplex(cscale(kz2, thicknessM)); // e^{i delta}
    const phase2 = cmul(phase, phase); // e^{2 i delta}
    const den = cadd(complex(1), cmul(cmul(r12, r23), phase2));
    r = cdiv(cadd(r12, cmul(r23, phase2)), den);
    t = cdiv(cmul(cmul(t12, t23), phase), den);
    // Slab amplitudes from the exit face. For an evanescent slab this keeps B
    // (the growing-wave amplitude, ~e^{-2 kappa d}) accurate instead of
    // obtaining it by cancellation at the entrance face.
    const q3OverQ2 = cdiv(q3, q2);
    A = cdiv(cscale(cmul(t, cadd(complex(1), q3OverQ2)), 0.5), phase);
    B = cscale(cmul(cmul(t, csub(complex(1), q3OverQ2)), phase), 0.5);
  }
  const psi0 = cadd(complex(1), r);
  const u0 = cmul(cmul(complex(0, 1), q1), csub(complex(1), r));

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
    nearCritical,
    A,
    B,
    psi0,
    u0,
    kz2Squared,
    p2,
    R,
    T,
    slabRegime,
    exitRegime,
    slabDecayLengthM: slabRegime === 'evanescent' ? 1 / kz2.im : null,
    reflectancePeriodLambda1:
      slabRegime === 'propagating' && exitRegime === 'propagating' && kz2.re > 1e-6 * k0
        ? Math.PI / kz2.re / wavelength1M
        : null,
    rayExitOffsetM:
      slabRegime === 'propagating' && kz2.re > 1e-6 * k0 ? (thicknessM * kx) / kz2.re : 0,
    airyMaxReflectance:
      symmetric &&
      slabRegime === 'propagating' &&
      exitRegime === 'propagating' &&
      kz2.re > 1e-6 * k0
        ? (4 * r12Abs2) / (1 + r12Abs2) ** 2
        : null,
    eta1: Math.sqrt(MU_0 / (EPSILON_0 * state.eps1R)),
  };
}
