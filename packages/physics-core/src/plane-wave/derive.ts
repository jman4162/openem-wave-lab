import { EPSILON_0, MU_0 } from '../constants';
import { cdiv, cmul, complex, csqrt, type Complex } from '../math/complex';
import { classifyPolarization, type PolarizationState } from './polarization';
import type { PlaneWaveState } from './state';

export interface PlaneWaveDerived {
  omega: number;
  /** eps_c = eps0*epsR + i sigma/omega (e^{-i omega t} convention: Im >= 0). */
  epsilonComplex: Complex;
  /** k = beta + i alpha, principal branch (beta > 0, alpha >= 0). */
  k: Complex;
  /** Phase constant, rad/m. */
  beta: number;
  /** Attenuation constant, Np/m. */
  alpha: number;
  wavelengthM: number;
  phaseVelocity: number;
  /** 1/alpha; null when lossless. */
  skinDepthM: number | null;
  /** Intrinsic impedance eta = sqrt(mu/eps_c), ohms. */
  eta: Complex;
  /** sigma/(omega eps). */
  lossTangent: number;
  polarization: PolarizationState;
  /** Period, s. */
  periodS: number;
}

export function derivePlaneWave(state: PlaneWaveState): PlaneWaveDerived {
  const omega = 2 * Math.PI * state.frequencyHz;
  const eps = EPSILON_0 * state.epsilonR;
  const mu = MU_0 * state.muR;
  const epsilonComplex = complex(eps, state.sigma / omega);

  // k = omega * sqrt(mu * eps_c); principal sqrt puts k in the first quadrant.
  const k = cmul(complex(omega), csqrt(cmul(complex(mu), epsilonComplex)));
  const beta = k.re;
  const alpha = k.im;

  const eta = csqrt(cdiv(complex(mu), epsilonComplex));

  return {
    omega,
    epsilonComplex,
    k,
    beta,
    alpha,
    wavelengthM: (2 * Math.PI) / beta,
    phaseVelocity: omega / beta,
    skinDepthM: alpha > 0 ? 1 / alpha : null,
    eta,
    lossTangent: state.sigma / (omega * eps),
    polarization: classifyPolarization(state.E0x, state.E0y, state.phaseYDeg),
    periodS: 1 / state.frequencyHz,
  };
}
