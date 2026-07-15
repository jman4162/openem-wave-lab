import {
  defaultPlanarInterfaceState,
  defaultPlaneWaveState,
  defaultSpreadingState,
  type PlanarInterfaceState,
  type PlaneWaveState,
  type SpreadingState,
} from '@openem/physics-core';
import { DEFAULT_SCENE, getManifest, MODULE_MANIFESTS } from '../modules/manifest';
import type { SceneId, SpreadingViewKind } from './store';

/**
 * Scene state <-> URL search params, schema version 1. Flat key=value pairs;
 * a `scene` key (omitted for the default plane-wave module) selects the
 * module and only the ACTIVE module's non-default params are written. Unknown
 * keys are ignored and malformed values fall back to defaults, so old links
 * keep working as the schema grows: Phase-0 URLs (no scene key) decode
 * unchanged by construction.
 */
export interface SceneSnapshot {
  scene: SceneId;
  planeWave: PlaneWaveState;
  spreading: SpreadingState;
  planarInterface: PlanarInterfaceState;
  tau: number;
  playing: boolean;
  speed: number;
  probeZeta: number;
  probeRho: number;
  probeX: number;
  probeZ: number;
  spreadingKind: SpreadingViewKind;
  spreadingCompare: boolean;
  spreadingEnvelope: boolean;
  spreadingLogPlot: boolean;
}

export const defaultSceneSnapshot: SceneSnapshot = {
  scene: DEFAULT_SCENE,
  planeWave: defaultPlaneWaveState,
  spreading: defaultSpreadingState,
  planarInterface: defaultPlanarInterfaceState,
  tau: 0,
  playing: true,
  speed: 0.25,
  probeZeta: 0.5,
  probeRho: 1,
  probeX: 0,
  probeZ: -0.5,
  spreadingKind: 'cylindrical',
  spreadingCompare: true,
  spreadingEnvelope: false,
  spreadingLogPlot: false,
};

/** Compact, round-trip-stable number encoding. */
const enc = (n: number): string => parseFloat(n.toPrecision(8)).toString();

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export function encodeScene(snapshot: SceneSnapshot): URLSearchParams {
  const out = new URLSearchParams({ v: '1' });
  if (snapshot.scene !== DEFAULT_SCENE) out.set('scene', snapshot.scene);

  const manifest = getManifest(snapshot.scene);
  if (manifest) {
    const slice = snapshot[manifest.sliceKey] as unknown as Record<string, unknown>;
    for (const [short, key] of Object.entries(manifest.urlParams)) {
      if (slice[key] !== manifest.defaults[key]) out.set(short, enc(Number(slice[key] ?? 0)));
    }
    for (const se of manifest.sliceEnums ?? []) {
      if (slice[se.key] !== manifest.defaults[se.key]) out.set(se.short, String(slice[se.key]));
    }
    for (const sb of manifest.sliceBools ?? []) {
      if (slice[sb.key] !== manifest.defaults[sb.key]) out.set(sb.short, slice[sb.key] ? '1' : '0');
    }
    for (const extra of manifest.extraNums) {
      if (snapshot[extra.storeKey] !== defaultSceneSnapshot[extra.storeKey]) {
        out.set(extra.short, enc(snapshot[extra.storeKey]));
      }
    }
    for (const extra of manifest.extraBools ?? []) {
      if (snapshot[extra.storeKey] !== defaultSceneSnapshot[extra.storeKey]) {
        out.set(extra.short, snapshot[extra.storeKey] ? '1' : '0');
      }
    }
    for (const extra of manifest.extraEnums ?? []) {
      if (snapshot[extra.storeKey] !== defaultSceneSnapshot[extra.storeKey]) {
        out.set(extra.short, snapshot[extra.storeKey]);
      }
    }
  }

  // tau is meaningful in a link only for a paused scene; while playing it
  // advances every frame and would churn the URL.
  if (!snapshot.playing) {
    out.set('pl', '0');
    if (snapshot.tau !== 0) out.set('t', enc(snapshot.tau));
  }
  if (snapshot.speed !== defaultSceneSnapshot.speed) out.set('spd', enc(snapshot.speed));
  return out;
}

export function decodeScene(search: string | URLSearchParams): SceneSnapshot {
  const input = typeof search === 'string' ? new URLSearchParams(search) : search;

  const rawScene = input.get('scene');
  const scene: SceneId = MODULE_MANIFESTS.some((m) => m.id === rawScene)
    ? (rawScene as SceneId)
    : DEFAULT_SCENE;

  const snapshot: SceneSnapshot = {
    ...defaultSceneSnapshot,
    scene,
    planeWave: { ...defaultPlaneWaveState },
    spreading: { ...defaultSpreadingState },
    planarInterface: { ...defaultPlanarInterfaceState },
  };

  const manifest = getManifest(scene);
  if (manifest) {
    const clampDefs = new Map(manifest.parameters.map((d) => [d.key, d]));
    const slice = snapshot[manifest.sliceKey] as unknown as Record<string, unknown>;
    for (const [short, key] of Object.entries(manifest.urlParams)) {
      const raw = input.get(short);
      if (raw === null) continue;
      const value = parseFloat(raw);
      if (!Number.isFinite(value)) continue;
      const def = clampDefs.get(key);
      slice[key] = def ? clamp(value, def.min, def.max) : value;
    }
    for (const se of manifest.sliceEnums ?? []) {
      const raw = input.get(se.short);
      if (raw !== null && se.values.includes(raw)) slice[se.key] = raw;
    }
    for (const sb of manifest.sliceBools ?? []) {
      const raw = input.get(sb.short);
      if (raw !== null) slice[sb.key] = raw !== '0';
    }
    for (const extra of manifest.extraNums) {
      const raw = input.get(extra.short);
      if (raw === null) continue;
      const value = parseFloat(raw);
      if (Number.isFinite(value)) snapshot[extra.storeKey] = clamp(value, extra.min, extra.max);
    }
    for (const extra of manifest.extraBools ?? []) {
      const raw = input.get(extra.short);
      if (raw !== null) snapshot[extra.storeKey] = raw !== '0';
    }
    for (const extra of manifest.extraEnums ?? []) {
      const raw = input.get(extra.short);
      if (raw !== null && extra.values.includes(raw)) {
        snapshot[extra.storeKey] = raw as SpreadingViewKind;
      }
    }
  }

  const num = (key: string, fallback: number, min: number, max: number): number => {
    const raw = input.get(key);
    if (raw === null) return fallback;
    const value = parseFloat(raw);
    return Number.isFinite(value) ? clamp(value, min, max) : fallback;
  };

  snapshot.playing = input.get('pl') !== '0';
  snapshot.tau = num('t', 0, 0, 1e6);
  snapshot.speed = num('spd', defaultSceneSnapshot.speed, 0.05, 2);
  return snapshot;
}
