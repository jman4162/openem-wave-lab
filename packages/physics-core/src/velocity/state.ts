import type { ParameterDefinition } from '../model';

/**
 * Phase/group/energy velocity in a dispersive medium with waveguide-type
 * dispersion omega(k) = sqrt(omega_c^2 + c_m^2 k^2) (the TE10/plasma form):
 * causal, exact, v_p v_g = c_m^2, and cutoff -> 0 recovers the
 * non-dispersive medium.
 */
export interface VelocityState {
  /** Mean carrier frequency f-bar. */
  frequencyHz: number;
  /** Cutoff as a fraction of the carrier, f_c / f-bar; 0 = non-dispersive. */
  cutoffFraction: number;
  /** Beat detuning Delta f / f-bar. */
  deltaFraction: number;
  /** Initial pulse width in carrier wavelengths. */
  sigmaLambda: number;
  epsilonR: number;
}

export const defaultVelocityState: VelocityState = {
  frequencyHz: 1e9,
  cutoffFraction: 0.6,
  deltaFraction: 0.08,
  sigmaLambda: 2,
  epsilonR: 1,
};

export const velocityParameters: ParameterDefinition[] = [
  {
    key: 'frequencyHz',
    label: 'Carrier frequency',
    unit: 'Hz',
    symbol: '\\bar{f}',
    min: 1e6,
    max: 1e12,
    default: 1e9,
    scale: 'log',
  },
  {
    key: 'cutoffFraction',
    label: 'Cutoff / carrier ratio',
    unit: '',
    symbol: 'f_c/\\bar{f}',
    min: 0,
    max: 0.95,
    default: 0.6,
    scale: 'linear',
  },
  {
    key: 'deltaFraction',
    label: 'Beat detuning Δf / f',
    unit: '',
    symbol: '\\Delta f/\\bar{f}',
    min: 0.02,
    max: 0.2,
    default: 0.08,
    scale: 'linear',
  },
  {
    key: 'sigmaLambda',
    label: 'Pulse width',
    unit: 'λ',
    symbol: '\\sigma_x/\\lambda',
    min: 1,
    max: 4,
    default: 2,
    scale: 'linear',
  },
  {
    key: 'epsilonR',
    label: 'Relative permittivity',
    unit: '',
    symbol: '\\varepsilon_r',
    min: 1,
    max: 80,
    default: 1,
    scale: 'linear',
  },
];
