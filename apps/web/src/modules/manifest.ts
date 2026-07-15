import {
  defaultPlanarInterfaceState,
  defaultPlaneWaveState,
  defaultSpreadingState,
  planarInterfaceModel,
  planeWaveModel,
  spreadingModel,
  type ParameterDefinition,
} from '@openem/physics-core';
import type { SceneId } from '../state/store';

/**
 * React-free description of each module for the URL codec and other
 * non-rendering consumers. The full module definitions (scene factories,
 * panel components) live in the registry and share these ids.
 */
export interface ModuleManifest {
  id: SceneId;
  /** Store slice holding this module's params. */
  sliceKey: 'planeWave' | 'spreading' | 'planarInterface';
  parameters: ParameterDefinition[];
  defaults: Record<string, unknown>;
  /** URL short key -> numeric param key in the slice. Distinct across modules. */
  urlParams: Record<string, string>;
  /** Non-numeric slice params (enums as strings, booleans as 0/1). */
  sliceEnums?: { short: string; key: string; values: readonly string[] }[];
  sliceBools?: { short: string; key: string }[];
  /** Flat store keys this module serializes (probe positions, view flags). */
  extraNums: {
    short: string;
    storeKey: 'probeZeta' | 'probeRho' | 'probeX' | 'probeZ';
    min: number;
    max: number;
  }[];
  extraBools?: {
    short: string;
    storeKey: 'spreadingCompare' | 'spreadingEnvelope' | 'spreadingLogPlot';
  }[];
  extraEnums?: { short: string; storeKey: 'spreadingKind'; values: readonly string[] }[];
}

export const MODULE_MANIFESTS: ModuleManifest[] = [
  {
    id: 'plane-wave',
    sliceKey: 'planeWave',
    parameters: planeWaveModel.parameters,
    defaults: defaultPlaneWaveState as unknown as Record<string, unknown>,
    urlParams: {
      f: 'frequencyHz',
      ex: 'E0x',
      ey: 'E0y',
      dphi: 'phaseYDeg',
      epsr: 'epsilonR',
      mur: 'muR',
      sig: 'sigma',
    },
    extraNums: [{ short: 'p', storeKey: 'probeZeta', min: 0, max: 2 }],
  },
  {
    id: 'spreading',
    sliceKey: 'spreading',
    parameters: spreadingModel.parameters,
    defaults: defaultSpreadingState as unknown as Record<string, unknown>,
    urlParams: {
      sf: 'frequencyHz',
      A: 'amplitude',
      sepsr: 'epsilonR',
      smur: 'muR',
    },
    extraNums: [{ short: 'pr', storeKey: 'probeRho', min: 0.25, max: 8 }],
    extraBools: [
      { short: 'cmp', storeKey: 'spreadingCompare' },
      { short: 'env', storeKey: 'spreadingEnvelope' },
      { short: 'logp', storeKey: 'spreadingLogPlot' },
    ],
    extraEnums: [
      { short: 'wk', storeKey: 'spreadingKind', values: ['plane', 'cylindrical', 'spherical'] },
    ],
  },
  {
    id: 'planar-interface',
    sliceKey: 'planarInterface',
    parameters: planarInterfaceModel.parameters,
    defaults: defaultPlanarInterfaceState as unknown as Record<string, unknown>,
    urlParams: {
      iff: 'frequencyHz',
      th: 'thetaDeg',
      e0: 'E0',
      e1: 'eps1R',
      m1: 'mu1R',
      e2: 'eps2R',
      m2: 'mu2R',
      s2: 'sigma2',
    },
    sliceEnums: [{ short: 'pol', key: 'polarization', values: ['TE', 'TM'] }],
    sliceBools: [{ short: 'pec', key: 'pec' }],
    extraNums: [
      { short: 'px', storeKey: 'probeX', min: -2, max: 2 },
      { short: 'pz', storeKey: 'probeZ', min: -2.5, max: 1.5 },
    ],
  },
];

export const getManifest = (id: SceneId): ModuleManifest | undefined =>
  MODULE_MANIFESTS.find((m) => m.id === id);

export const DEFAULT_SCENE: SceneId = 'plane-wave';
