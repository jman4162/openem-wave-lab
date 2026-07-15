import { C_0 } from '../constants';
import type { VelocityState } from './state';

export interface VelocityDerived {
  omega: number;
  /** Cutoff angular frequency (from cutoffFraction). */
  omegaC: number;
  /** Medium light speed c_m = c0/sqrt(eps_r). */
  cM: number;
  /** Carrier wavenumber k(omega). */
  k: number;
  wavelengthM: number;
  periodS: number;
  /** Phase velocity omega/k. */
  vP: number;
  /** Group velocity d(omega)/dk = c_m^2 k / omega. */
  vG: number;
  /** Energy velocity; equals vG for this lossless medium. */
  vE: number;
  /** Group-velocity dispersion omega''(k) = (c_m^2 - v_g^2)/omega, >= 0. */
  gvd: number;
  /** Effective beat detuning after the near-cutoff clamp, rad/s. */
  deltaOmega: number;
  deltaK: number;
  /** Beat envelope wavelength 2*pi/deltaK. */
  beatWavelengthM: number;
  /** Envelope velocity deltaOmega/deltaK (finite-difference v_g). */
  envelopeVelocity: number;
  /** Lower/upper beat components. */
  omega1: number;
  omega2: number;
  k1: number;
  k2: number;
  /** Initial pulse width, meters. */
  sigmaXM: number;
  /** Numerical warnings (spec 8.2): clamps applied near cutoff. */
  warnings: string[];
}

const kOf = (omega: number, omegaC: number, cM: number): number =>
  Math.sqrt(Math.max(omega * omega - omegaC * omegaC, 0)) / cM;

export function deriveVelocity(state: VelocityState): VelocityDerived {
  const warnings: string[] = [];
  const omega = 2 * Math.PI * state.frequencyHz;
  const omegaC = state.cutoffFraction * omega;
  const cM = C_0 / Math.sqrt(state.epsilonR);

  const k = kOf(omega, omegaC, cM);
  const vP = omega / k;
  const vG = (cM * cM * k) / omega;

  // Both beat components must stay above cutoff with margin.
  const maxDelta = 2 * (1 - state.cutoffFraction - 0.02);
  let deltaFraction = state.deltaFraction;
  if (deltaFraction > maxDelta) {
    deltaFraction = Math.max(maxDelta, 0);
    warnings.push(
      `Beat detuning clamped to ${(deltaFraction * 100).toFixed(1)}% so both components stay above cutoff`,
    );
  }
  const deltaOmega = deltaFraction * omega;
  const omega1 = omega - deltaOmega / 2;
  const omega2 = omega + deltaOmega / 2;
  const k1 = kOf(omega1, omegaC, cM);
  const k2 = kOf(omega2, omegaC, cM);
  const deltaK = k2 - k1;

  const wavelengthM = (2 * Math.PI) / k;

  return {
    omega,
    omegaC,
    cM,
    k,
    wavelengthM,
    periodS: 1 / state.frequencyHz,
    vP,
    vG,
    vE: vG,
    gvd: (cM * cM - vG * vG) / omega,
    deltaOmega,
    deltaK,
    beatWavelengthM: deltaK > 0 ? (2 * Math.PI) / deltaK : Infinity,
    envelopeVelocity: deltaK > 0 ? deltaOmega / deltaK : vG,
    omega1,
    omega2,
    k1,
    k2,
    sigmaXM: state.sigmaLambda * wavelengthM,
    warnings,
  };
}
