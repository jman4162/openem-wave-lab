import { describe, expect, it } from 'vitest';
import {
  decodeScene,
  defaultSceneSnapshot,
  encodeScene,
  type SceneSnapshot,
} from '../src/state/urlCodec';

describe('URL codec', () => {
  it('default state encodes to just the schema version', () => {
    expect(encodeScene(defaultSceneSnapshot).toString()).toBe('v=1');
  });

  it('encode then decode is the identity (plane-wave)', () => {
    const snapshot: SceneSnapshot = {
      ...defaultSceneSnapshot,
      planeWave: {
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
    expect(decodeScene(encodeScene(snapshot))).toEqual(snapshot);
  });

  it('encode then decode is the identity (spreading, incl. view flags)', () => {
    const snapshot: SceneSnapshot = {
      ...defaultSceneSnapshot,
      scene: 'spreading',
      spreading: { frequencyHz: 3e9, amplitude: 1.5, epsilonR: 9, muR: 1 },
      probeRho: 2.5,
      spreadingKind: 'spherical',
      spreadingCompare: false,
      spreadingEnvelope: true,
      spreadingLogPlot: true,
    };
    expect(decodeScene(encodeScene(snapshot))).toEqual(snapshot);
  });

  it('invalid enum values fall back to the default wave kind', () => {
    expect(decodeScene('v=1&scene=spreading&wk=hexagonal').spreadingKind).toBe('cylindrical');
  });

  it('encode then decode is the identity (planar interface, incl. discrete params)', () => {
    const snapshot: SceneSnapshot = {
      ...defaultSceneSnapshot,
      scene: 'planar-interface',
      planarInterface: {
        frequencyHz: 1e9,
        thetaDeg: 45,
        polarization: 'TM',
        E0: 1,
        eps1R: 4,
        mu1R: 1,
        eps2R: 1,
        mu2R: 1,
        sigma2: 0.3,
        pec: false,
      },
      probeX: 0.5,
      probeZ: 0.25,
    };
    expect(decodeScene(encodeScene(snapshot))).toEqual(snapshot);
  });

  it('PEC flag and polarization survive the round trip; junk enum ignored', () => {
    const snapshot: SceneSnapshot = {
      ...defaultSceneSnapshot,
      scene: 'planar-interface',
      planarInterface: { ...defaultSceneSnapshot.planarInterface, pec: true },
    };
    const decoded = decodeScene(encodeScene(snapshot));
    expect(decoded.planarInterface.pec).toBe(true);
    expect(decodeScene('v=1&scene=planar-interface&pol=XY').planarInterface.polarization).toBe(
      'TE',
    );
  });

  it('BACKWARD COMPAT: a literal Phase-0 link decodes unchanged', () => {
    // Published before the scene key existed; must keep working forever.
    const decoded = decodeScene('v=1&ey=1&dphi=90&pl=0&t=0.75');
    expect(decoded.scene).toBe('plane-wave');
    expect(decoded.planeWave.E0y).toBe(1);
    expect(decoded.planeWave.phaseYDeg).toBe(90);
    expect(decoded.playing).toBe(false);
    expect(decoded.tau).toBe(0.75);
  });

  it('scene key is omitted for the default module and written otherwise', () => {
    expect(encodeScene(defaultSceneSnapshot).has('scene')).toBe(false);
    const spreading = encodeScene({ ...defaultSceneSnapshot, scene: 'spreading' });
    expect(spreading.get('scene')).toBe('spreading');
  });

  it('unknown scene falls back to plane-wave', () => {
    expect(decodeScene('v=1&scene=warp-drive').scene).toBe('plane-wave');
  });

  it('only the active module params are encoded', () => {
    const snapshot: SceneSnapshot = {
      ...defaultSceneSnapshot,
      scene: 'spreading',
      planeWave: { ...defaultSceneSnapshot.planeWave, E0y: 1 },
      spreading: { ...defaultSceneSnapshot.spreading, epsilonR: 9 },
    };
    const encoded = encodeScene(snapshot);
    expect(encoded.get('sepsr')).toBe('9');
    expect(encoded.has('ey')).toBe(false);
  });

  it('paused time round-trips; playing time is not serialized', () => {
    const paused = { ...defaultSceneSnapshot, playing: false, tau: 1.5 };
    expect(decodeScene(encodeScene(paused)).tau).toBe(1.5);

    const playing = { ...defaultSceneSnapshot, playing: true, tau: 1.5 };
    const decoded = decodeScene(encodeScene(playing));
    expect(decoded.playing).toBe(true);
    expect(decoded.tau).toBe(0);
  });

  it('junk values fall back to defaults', () => {
    expect(decodeScene('v=1&f=banana&ex=NaN&p=')).toEqual(defaultSceneSnapshot);
  });

  it('unknown keys are ignored', () => {
    const decoded = decodeScene('v=1&futureKey=42&ey=1');
    expect(decoded.planeWave.E0y).toBe(1);
    expect(decoded.planeWave.E0x).toBe(defaultSceneSnapshot.planeWave.E0x);
  });

  it('out-of-range values are clamped to parameter bounds', () => {
    const decoded = decodeScene('v=1&f=1e20&epsr=-3&p=99');
    expect(decoded.planeWave.frequencyHz).toBe(1e12);
    expect(decoded.planeWave.epsilonR).toBe(1);
    expect(decoded.probeZeta).toBe(2);
  });

  it('empty query yields defaults', () => {
    expect(decodeScene('')).toEqual(defaultSceneSnapshot);
  });
});
