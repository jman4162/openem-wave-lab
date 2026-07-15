import type { ParameterDefinition } from '../model';

/**
 * Plane wave obliquely incident on a planar interface at z = 0.
 * Medium 1 (z < 0) is lossless by construction; medium 2 (z > 0) may be lossy
 * or a perfect electric conductor. Plane of incidence is x-z.
 */
export interface PlanarInterfaceState {
  frequencyHz: number;
  /** Incidence angle from the interface normal, degrees. Clamped below 90 to avoid the grazing 0/0. */
  thetaDeg: number;
  /** TE (s-pol, E = Ey) or TM (p-pol, H = Hy). */
  polarization: 'TE' | 'TM';
  /** Incident E amplitude, V/m. */
  E0: number;
  eps1R: number;
  mu1R: number;
  eps2R: number;
  mu2R: number;
  /** Medium-2 conductivity, S/m. */
  sigma2: number;
  /** Medium 2 is a perfect electric conductor (exact special case, not large sigma). */
  pec: boolean;
}

export const defaultPlanarInterfaceState: PlanarInterfaceState = {
  frequencyHz: 1e9,
  thetaDeg: 30,
  polarization: 'TE',
  E0: 1,
  eps1R: 1,
  mu1R: 1,
  eps2R: 4,
  mu2R: 1,
  sigma2: 0,
  pec: false,
};

/** Numeric parameters only; polarization and PEC are discrete UI controls. */
export const planarInterfaceParameters: ParameterDefinition[] = [
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
    key: 'thetaDeg',
    label: 'Incidence angle',
    unit: 'deg',
    symbol: '\\theta_i',
    min: 0,
    max: 89.5,
    default: 30,
    scale: 'linear',
  },
  {
    key: 'E0',
    label: 'Incident amplitude',
    unit: 'V/m',
    symbol: 'E_0',
    min: 0.1,
    max: 2,
    default: 1,
    scale: 'linear',
  },
  {
    key: 'eps1R',
    label: 'Medium 1 permittivity',
    unit: '',
    symbol: '\\varepsilon_{r1}',
    min: 1,
    max: 12,
    default: 1,
    scale: 'linear',
  },
  {
    key: 'mu1R',
    label: 'Medium 1 permeability',
    unit: '',
    symbol: '\\mu_{r1}',
    min: 1,
    max: 10,
    default: 1,
    scale: 'linear',
  },
  {
    key: 'eps2R',
    label: 'Medium 2 permittivity',
    unit: '',
    symbol: '\\varepsilon_{r2}',
    min: 1,
    max: 12,
    default: 4,
    scale: 'linear',
  },
  {
    key: 'mu2R',
    label: 'Medium 2 permeability',
    unit: '',
    symbol: '\\mu_{r2}',
    min: 1,
    max: 10,
    default: 1,
    scale: 'linear',
  },
  {
    key: 'sigma2',
    label: 'Medium 2 conductivity',
    unit: 'S/m',
    symbol: '\\sigma_2',
    min: 0,
    max: 10,
    default: 0,
    scale: 'linear',
  },
];
