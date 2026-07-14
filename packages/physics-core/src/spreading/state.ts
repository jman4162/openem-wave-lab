import type { ParameterDefinition } from '../model';

/**
 * Scalar wave-spreading comparison: plane, cylindrical (line source), and
 * spherical (point source) waves in a lossless medium. Scalar model only -
 * these are Green-function fields, not the vector field of an EM source.
 */
export interface SpreadingState {
  frequencyHz: number;
  /** Field amplitude at the reference radius (one wavelength), arbitrary units. */
  amplitude: number;
  epsilonR: number;
  muR: number;
}

export const defaultSpreadingState: SpreadingState = {
  frequencyHz: 1e9,
  amplitude: 1,
  epsilonR: 1,
  muR: 1,
};

export const spreadingParameters: ParameterDefinition[] = [
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
    key: 'amplitude',
    label: 'Amplitude at reference radius',
    unit: '',
    symbol: 'A',
    min: 0.1,
    max: 2,
    default: 1,
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
  {
    key: 'muR',
    label: 'Relative permeability',
    unit: '',
    symbol: '\\mu_r',
    min: 1,
    max: 10,
    default: 1,
    scale: 'linear',
  },
];
