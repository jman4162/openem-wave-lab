import { describe, expect, it } from 'vitest';
import {
  decodeScene,
  defaultSceneUrlState,
  encodeScene,
  type SceneUrlState,
} from '../src/state/urlCodec';

describe('URL codec', () => {
  it('default state encodes to just the schema version', () => {
    expect(encodeScene(defaultSceneUrlState).toString()).toBe('v=1');
  });

  it('encode then decode is the identity', () => {
    const state: SceneUrlState = {
      params: {
        frequencyHz: 2.45e9,
        E0x: 1,
        E0y: 0.5,
        phaseYDeg: 90,
        epsilonR: 4,
        muR: 1,
        sigma: 0.02,
      },
      tau: 0.75,
      playing: false,
      speed: 0.5,
      probeZeta: 1.25,
    };
    expect(decodeScene(encodeScene(state))).toEqual(state);
  });

  it('paused time round-trips; playing time is not serialized', () => {
    const paused = { ...defaultSceneUrlState, playing: false, tau: 1.5 };
    expect(decodeScene(encodeScene(paused)).tau).toBe(1.5);

    const playing = { ...defaultSceneUrlState, playing: true, tau: 1.5 };
    const decoded = decodeScene(encodeScene(playing));
    expect(decoded.playing).toBe(true);
    expect(decoded.tau).toBe(0);
  });

  it('junk values fall back to defaults', () => {
    const decoded = decodeScene('v=1&f=banana&ex=NaN&p=');
    expect(decoded).toEqual(defaultSceneUrlState);
  });

  it('unknown keys are ignored', () => {
    const decoded = decodeScene('v=1&futureKey=42&ey=1');
    expect(decoded.params.E0y).toBe(1);
    expect(decoded.params.E0x).toBe(defaultSceneUrlState.params.E0x);
  });

  it('out-of-range values are clamped to parameter bounds', () => {
    const decoded = decodeScene('v=1&f=1e20&epsr=-3&p=99');
    expect(decoded.params.frequencyHz).toBe(1e12);
    expect(decoded.params.epsilonR).toBe(1);
    expect(decoded.probeZeta).toBe(2);
  });

  it('empty query yields defaults', () => {
    expect(decodeScene('')).toEqual(defaultSceneUrlState);
  });
});
