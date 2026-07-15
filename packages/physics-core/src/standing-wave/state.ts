import type { ParameterDefinition } from '../model';

/**
 * Superposition of a forward wave and a reflected wave on z in [-4 lambda, 0]
 * with the termination at z = 0: E~(z) = E0 (e^{ikz} + Gamma e^{-ikz}).
 * Terminations are just parameter presets: short Gamma = -1 (|G|=1, 180 deg),
 * open Gamma = +1, matched Gamma = 0.
 */
export interface StandingWaveState {
  frequencyHz: number;
  E0: number;
  gammaMag: number;
  gammaPhaseDeg: number;
  epsilonR: number;
}

export const defaultStandingWaveState: StandingWaveState = {
  frequencyHz: 1e9,
  E0: 1,
  gammaMag: 1,
  gammaPhaseDeg: 180,
  epsilonR: 1,
};

export const standingWaveParameters: ParameterDefinition[] = [
  {
    key: 'frequencyHz',
    label: 'Frequency',
    unit: 'Hz',
    symbol: 'f',
    min: 1e6,
    max: 1e12,
    default: 1e9,
    scale: 'log',
  },
  {
    key: 'E0',
    label: 'Forward amplitude',
    unit: 'V/m',
    symbol: 'E_0',
    min: 0.1,
    max: 2,
    default: 1,
    scale: 'linear',
  },
  {
    key: 'gammaMag',
    label: 'Reflection magnitude |Γ|',
    unit: '',
    symbol: '|\\Gamma|',
    min: 0,
    max: 1,
    default: 1,
    scale: 'linear',
  },
  {
    key: 'gammaPhaseDeg',
    label: 'Reflection phase ∠Γ',
    unit: 'deg',
    symbol: '\\angle\\Gamma',
    min: -180,
    max: 180,
    default: 180,
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
