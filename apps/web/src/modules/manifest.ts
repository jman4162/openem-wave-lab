import {
  defaultPlaneWaveState,
  defaultSpreadingState,
  planeWaveModel,
  spreadingModel,
  type ParameterDefinition,
} from '@openem/physics-core';
import type { SceneId } from '../state/store';

/**
 * React-free description of each module for the URL codec and other
 * non-rendering consumers. The full module definitions (scene factories,
 * panel components) live in registry.tsx and share these ids.
 */
export interface ModuleManifest {
  id: SceneId;
  /** Store slice holding this module's params. */
  sliceKey: 'planeWave' | 'spreading';
  parameters: ParameterDefinition[];
  defaults: Record<string, number>;
  /** URL short key -> param key. Distinct across modules for readability. */
  urlParams: Record<string, string>;
  /** Flat store keys this module serializes (probe positions, view flags). */
  extraNums: { short: string; storeKey: 'probeZeta' | 'probeRho'; min: number; max: number }[];
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
    defaults: defaultPlaneWaveState as unknown as Record<string, number>,
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
    defaults: defaultSpreadingState as unknown as Record<string, number>,
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
];

export const getManifest = (id: SceneId): ModuleManifest | undefined =>
  MODULE_MANIFESTS.find((m) => m.id === id);

export const DEFAULT_SCENE: SceneId = 'plane-wave';
