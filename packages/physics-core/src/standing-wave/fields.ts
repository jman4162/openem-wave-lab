import { C_0 } from '../constants';
import { cadd, cdiv, cmul, complex, cscale, csub, expi, type Complex } from '../math/complex';
import type { StandingWaveState } from './state';

export interface StandingWaveDerived {
  omega: number;
  k: number;
  wavelengthM: number;
  periodS: number;
  gamma: Complex;
  /** Standing-wave ratio (1+|G|)/(1-|G|); Infinity at |G| = 1. */
  swr: number;
  envelopeMaxV: number;
  envelopeMinV: number;
  /** First envelope minimum position in (-lambda/2, 0]. */
  firstMinZM: number;
  /** Adjacent minima spacing, lambda/2. */
  nodeSpacingM: number;
  /** Net time-averaged flux, normalized to the forward-wave flux: 1 - |G|^2. */
  netFluxNorm: number;
  /** Normalized load impedance (1+Gamma)/(1-Gamma); null at Gamma = 1 (open). */
  zLoadNorm: Complex | null;
}

export function deriveStandingWave(state: StandingWaveState): StandingWaveDerived {
  const omega = 2 * Math.PI * state.frequencyHz;
  const cM = C_0 / Math.sqrt(state.epsilonR);
  const k = omega / cM;
  const wavelengthM = (2 * Math.PI) / k;
  const phi = (state.gammaPhaseDeg * Math.PI) / 180;
  const gamma = cscale(expi(phi), state.gammaMag);
  const g = state.gammaMag;

  // Envelope minima at 2kz + phi = pi (mod 2pi); place the first in (-lambda/2, 0].
  let zMin = (Math.PI - phi) / (2 * k);
  const half = wavelengthM / 2;
  while (zMin > 0) zMin -= half;
  while (zMin <= -half) zMin += half;

  const denom = csub(complex(1), gamma);
  const denomMag = Math.hypot(denom.re, denom.im);

  return {
    omega,
    k,
    wavelengthM,
    periodS: 1 / state.frequencyHz,
    gamma,
    swr: g < 1 ? (1 + g) / (1 - g) : Infinity,
    envelopeMaxV: state.E0 * (1 + g),
    envelopeMinV: state.E0 * (1 - g),
    firstMinZM: zMin,
    nodeSpacingM: half,
    netFluxNorm: 1 - g * g,
    zLoadNorm: denomMag > 1e-12 ? cdiv(cadd(complex(1), gamma), denom) : null,
  };
}

/** Phasor E~(z) = E0 (e^{ikz} + Gamma e^{-ikz}) — e^{+ikz} is forward under e^{-i omega t}. */
export function standingWavePhasorAt(
  state: StandingWaveState,
  derived: StandingWaveDerived,
  z: number,
): Complex {
  const forward = expi(derived.k * z);
  const backward = cmul(derived.gamma, expi(-derived.k * z));
  return cscale(cadd(forward, backward), state.E0);
}

/** Envelope |E~(z)| = E0 sqrt(1 + |G|^2 + 2|G| cos(2kz + phi)). */
export function standingWaveEnvelopeAt(
  state: StandingWaveState,
  derived: StandingWaveDerived,
  z: number,
): number {
  const g = state.gammaMag;
  const phi = (state.gammaPhaseDeg * Math.PI) / 180;
  return state.E0 * Math.sqrt(Math.max(0, 1 + g * g + 2 * g * Math.cos(2 * derived.k * z + phi)));
}

/**
 * Normalized net flux computed FROM THE FIELD: Im{E~* dE~/dz} / (k E0^2).
 * Analytically z-independent and equal to 1 - |Gamma|^2 (conservation).
 */
export function standingWaveFluxAt(
  state: StandingWaveState,
  derived: StandingWaveDerived,
  z: number,
): number {
  const { k, gamma } = derived;
  const psi = standingWavePhasorAt(state, derived, z);
  const dpsi = cmul(complex(0, k), cscale(csub(expi(k * z), cmul(gamma, expi(-k * z))), state.E0));
  const im = psi.re * dpsi.im - psi.im * dpsi.re; // Im{conj(psi) * dpsi}
  return im / (k * state.E0 * state.E0);
}
