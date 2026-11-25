import type { ParameterDefinition } from '../model';

/**
 * Plane wave obliquely incident on a dielectric slab. Medium 1 (z < 0) holds
 * the incident and reflected waves, the slab (medium 2) fills 0 <= z <= d, and
 * medium 3 (z > d) holds the transmitted wave. All three media are lossless
 * and nonmagnetic. Plane of incidence is x-z, as in the planar-interface model.
 */
export interface LayeredSlabState {
  frequencyHz: number;
  /** Incidence angle in medium 1 from the slab normal, degrees. */
  thetaDeg: number;
  /** TE (s-pol, E = Ey) or TM (p-pol, H = Hy). */
  polarization: 'TE' | 'TM';
  /** Incident E amplitude, V/m. */
  E0: number;
  eps1R: number;
  /** Slab relative permittivity. */
  eps2R: number;
  eps3R: number;
  /** Slab thickness d in medium-1 wavelengths (d / lambda_1). */
  thicknessLambda1: number;
}

/**
 * Default: the frustrated-TIR case of a Virginia Tech ECE 5105 exam problem
 * (eps 4 | 1 | 4 at 60 degrees, TE): the slab is evanescent and power tunnels
 * across it.
 */
export const defaultLayeredSlabState: LayeredSlabState = {
  frequencyHz: 1e9,
  thetaDeg: 60,
  polarization: 'TE',
  E0: 1,
  eps1R: 4,
  eps2R: 1,
  eps3R: 4,
  thicknessLambda1: 0.3,
};

/** Numeric parameters only; polarization is a discrete UI control. */
export const layeredSlabParameters: ParameterDefinition[] = [
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
    default: 60,
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
    default: 4,
    scale: 'linear',
  },
  {
    key: 'eps2R',
    label: 'Slab permittivity',
    unit: '',
    symbol: '\\varepsilon_{r2}',
    min: 1,
    max: 12,
    default: 1,
    scale: 'linear',
  },
  {
    key: 'eps3R',
    label: 'Medium 3 permittivity',
    unit: '',
    symbol: '\\varepsilon_{r3}',
    min: 1,
    max: 12,
    default: 4,
    scale: 'linear',
  },
  {
    key: 'thicknessLambda1',
    label: 'Slab thickness',
    unit: 'λ₁',
    symbol: 'd/\\lambda_1',
    min: 0,
    max: 2,
    default: 0.3,
    scale: 'linear',
  },
];
