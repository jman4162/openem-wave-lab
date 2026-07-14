import type { ParameterDefinition } from '../model';

/**
 * Uniform plane wave propagating along +z in a homogeneous isotropic medium.
 * E lies in the xy-plane: E~(z) = (E0x x^ + E0y e^{i delta} y^) e^{ikz},
 * with delta = phaseYDeg. Amplitudes are peak values in V/m.
 */
export interface PlaneWaveState {
  frequencyHz: number;
  E0x: number;
  E0y: number;
  phaseYDeg: number;
  epsilonR: number;
  muR: number;
  /** Conductivity, S/m. 0 means lossless. */
  sigma: number;
}

export const defaultPlaneWaveState: PlaneWaveState = {
  frequencyHz: 1e9,
  E0x: 1,
  E0y: 0,
  phaseYDeg: 0,
  epsilonR: 1,
  muR: 1,
  sigma: 0,
};

export const planeWaveParameters: ParameterDefinition[] = [
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
    key: 'E0x',
    label: 'E-field x amplitude',
    unit: 'V/m',
    symbol: 'E_{0x}',
    min: 0,
    max: 2,
    default: 1,
    scale: 'linear',
  },
  {
    key: 'E0y',
    label: 'E-field y amplitude',
    unit: 'V/m',
    symbol: 'E_{0y}',
    min: 0,
    max: 2,
    default: 0,
    scale: 'linear',
  },
  {
    key: 'phaseYDeg',
    label: 'Phase of E_y relative to E_x',
    unit: 'deg',
    symbol: '\\delta',
    min: -180,
    max: 180,
    default: 0,
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
  {
    key: 'sigma',
    label: 'Conductivity',
    unit: 'S/m',
    symbol: '\\sigma',
    min: 0,
    max: 100,
    default: 0,
    scale: 'linear',
  },
];
