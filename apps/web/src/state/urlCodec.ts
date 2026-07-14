import { defaultPlaneWaveState, planeWaveModel, type PlaneWaveState } from '@openem/physics-core';

/**
 * Scene state <-> URL search params, schema version 1. Flat key=value pairs,
 * only non-default keys are written, unknown keys are ignored and malformed
 * values fall back to defaults, so old links keep working as the schema grows.
 */
export interface SceneUrlState {
  params: PlaneWaveState;
  tau: number;
  playing: boolean;
  speed: number;
  probeZeta: number;
}

export const defaultSceneUrlState: SceneUrlState = {
  params: defaultPlaneWaveState,
  tau: 0,
  playing: true,
  speed: 0.25,
  probeZeta: 0.5,
};

const PARAM_KEYS: Record<string, keyof PlaneWaveState> = {
  f: 'frequencyHz',
  ex: 'E0x',
  ey: 'E0y',
  dphi: 'phaseYDeg',
  epsr: 'epsilonR',
  mur: 'muR',
  sig: 'sigma',
};

const clampDefs = new Map(planeWaveModel.parameters.map((d) => [d.key, d]));

/** Compact, round-trip-stable number encoding. */
const enc = (n: number): string => parseFloat(n.toPrecision(8)).toString();

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export function encodeScene(state: SceneUrlState): URLSearchParams {
  const out = new URLSearchParams({ v: '1' });
  for (const [short, key] of Object.entries(PARAM_KEYS)) {
    if (state.params[key] !== defaultSceneUrlState.params[key]) {
      out.set(short, enc(state.params[key]));
    }
  }
  // tau is meaningful in a link only for a paused scene; while playing it
  // advances every frame and would churn the URL.
  if (!state.playing) {
    out.set('pl', '0');
    if (state.tau !== 0) out.set('t', enc(state.tau));
  }
  if (state.speed !== defaultSceneUrlState.speed) out.set('spd', enc(state.speed));
  if (state.probeZeta !== defaultSceneUrlState.probeZeta) out.set('p', enc(state.probeZeta));
  return out;
}

export function decodeScene(search: string | URLSearchParams): SceneUrlState {
  const input = typeof search === 'string' ? new URLSearchParams(search) : search;
  const params = { ...defaultSceneUrlState.params };

  for (const [short, key] of Object.entries(PARAM_KEYS)) {
    const raw = input.get(short);
    if (raw === null) continue;
    const value = parseFloat(raw);
    if (!Number.isFinite(value)) continue;
    const def = clampDefs.get(key);
    params[key] = def ? clamp(value, def.min, def.max) : value;
  }

  const num = (key: string, fallback: number, min: number, max: number): number => {
    const raw = input.get(key);
    if (raw === null) return fallback;
    const value = parseFloat(raw);
    return Number.isFinite(value) ? clamp(value, min, max) : fallback;
  };

  return {
    params,
    tau: num('t', 0, 0, 1e6),
    playing: input.get('pl') !== '0',
    speed: num('spd', defaultSceneUrlState.speed, 0.05, 2),
    probeZeta: num('p', defaultSceneUrlState.probeZeta, 0, 2),
  };
}
