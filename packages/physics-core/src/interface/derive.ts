import { EPSILON_0, MU_0 } from '../constants';
import { cabs, cadd, cdiv, complex, cscale, csqrt, csub, type Complex } from '../math/complex';
import type { PlanarInterfaceState } from './state';

export type InterfaceRegime = 'propagating' | 'evanescent' | 'lossy' | 'pec';

export interface InterfaceDerived {
  omega: number;
  /** Medium-1 wavenumber (real; medium 1 is lossless). */
  k1: number;
  wavelength1M: number;
  periodS: number;
  /** Tangential wavenumber kx = k1 sin(theta) - conserved across the interface (Snell). */
  kx: number;
  /** Normal wavenumber in medium 1, kz1 = k1 cos(theta), real >= 0. */
  kz1: number;
  /** eps_c2 = eps0*eps2R + i sigma2/omega. */
  epsilon2Complex: Complex;
  /** kz2 = sqrt(k2^2 - kx^2), branch Im kz2 >= 0 so e^{i kz2 z} decays into medium 2. */
  kz2: Complex;
  /**
   * Reflection coefficient. TE: ratio of reflected to incident Ey.
   * TM: ratio of reflected to incident Hy (E-field ratio is the NEGATIVE of
   * this - docs/physics-conventions.md).
   */
  r: Complex;
  /** Transmission coefficient t = 1 + r for the same continuous scalar. */
  t: Complex;
  /** Power reflectance |r|^2. */
  R: number;
  /** Power transmittance from the closed-form flux ratio (cross-checked against E x H in tests). */
  T: number;
  /** Brewster angle, degrees; null unless lossless nonmagnetic TM case. */
  thetaBrewsterDeg: number | null;
  /** Critical angle, degrees; null unless lossless with n1 > n2. */
  thetaCriticalDeg: number | null;
  regime: InterfaceRegime;
  /** 1/Im(kz2): evanescent/lossy penetration depth into medium 2; null if propagating. */
  penetrationDepthM: number | null;
  /** Medium-1 intrinsic impedance (real). */
  eta1: number;
}

export function derivePlanarInterface(state: PlanarInterfaceState): InterfaceDerived {
  const omega = 2 * Math.PI * state.frequencyHz;
  const eps1 = EPSILON_0 * state.eps1R;
  const mu1 = MU_0 * state.mu1R;
  const mu2 = MU_0 * state.mu2R;
  const epsilon2Complex = complex(EPSILON_0 * state.eps2R, state.sigma2 / omega);

  const k1 = omega * Math.sqrt(mu1 * eps1);
  const theta = (state.thetaDeg * Math.PI) / 180;
  const kx = k1 * Math.sin(theta);
  const kz1 = k1 * Math.cos(theta);

  // k2^2 = omega^2 mu2 eps_c2; kz2 = sqrt(k2^2 - kx^2) with Im kz2 >= 0 so the
  // transmitted e^{i kz2 z} decays away from the interface (TIR and loss).
  const k2sq = cscale(epsilon2Complex, omega * omega * mu2);
  let kz2 = csqrt(csub(k2sq, complex(kx * kx)));
  if (kz2.im < 0) kz2 = cscale(kz2, -1);

  // Fresnel in kz form - valid verbatim for complex kz2.
  // TE: r = (kz1/mu1 - kz2/mu2)/(kz1/mu1 + kz2/mu2)
  // TM (Hy ratio): r = (kz1/eps1 - kz2/eps_c2)/(kz1/eps1 + kz2/eps_c2)
  let r: Complex;
  if (state.pec) {
    r = state.polarization === 'TE' ? complex(-1) : complex(1);
  } else if (state.polarization === 'TE') {
    const a = complex(kz1 / mu1);
    const b = cscale(kz2, 1 / mu2);
    r = cdiv(csub(a, b), cadd(a, b));
  } else {
    const a = complex(kz1 / eps1);
    const b = cdiv(kz2, epsilon2Complex);
    r = cdiv(csub(a, b), cadd(a, b));
  }
  const t = state.pec ? complex(0) : cadd(complex(1), r);

  const R = cabs(r) ** 2;
  // Closed-form transmitted flux ratio at z = 0+ (checked against E x H in tests):
  // TE: T = Re{kz2/mu2}/(kz1/mu1) |t|^2;  TM: T = Re{kz2/eps_c2}/(kz1/eps1) |t|^2.
  let T = 0;
  if (!state.pec && kz1 > 0) {
    T =
      state.polarization === 'TE'
        ? (cscale(kz2, 1 / mu2).re / (kz1 / mu1)) * cabs(t) ** 2
        : (cdiv(kz2, epsilon2Complex).re / (kz1 / eps1)) * cabs(t) ** 2;
  }

  const lossless = state.sigma2 === 0 && !state.pec;
  const nonmagnetic = state.mu1R === 1 && state.mu2R === 1;
  const thetaBrewsterDeg =
    lossless && nonmagnetic && state.polarization === 'TM'
      ? (Math.atan(Math.sqrt(state.eps2R / state.eps1R)) * 180) / Math.PI
      : null;

  const n1 = Math.sqrt(state.eps1R * state.mu1R);
  const n2 = Math.sqrt(state.eps2R * state.mu2R);
  const thetaCriticalDeg = lossless && n1 > n2 ? (Math.asin(n2 / n1) * 180) / Math.PI : null;

  const regime: InterfaceRegime = state.pec
    ? 'pec'
    : state.sigma2 > 0
      ? 'lossy'
      : kz2.im > 1e-9 * k1
        ? 'evanescent'
        : 'propagating';

  return {
    omega,
    k1,
    wavelength1M: (2 * Math.PI) / k1,
    periodS: 1 / state.frequencyHz,
    kx,
    kz1,
    epsilon2Complex,
    kz2,
    r,
    t,
    R,
    T,
    thetaBrewsterDeg,
    thetaCriticalDeg,
    regime,
    penetrationDepthM: kz2.im > 0 ? 1 / kz2.im : null,
    eta1: Math.sqrt(mu1 / eps1),
  };
}
