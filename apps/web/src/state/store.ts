import { create } from 'zustand';
import {
  defaultPlaneWaveState,
  defaultSpreadingState,
  type PlaneWaveState,
  type SpreadingState,
} from '@openem/physics-core';

export type SceneId = 'plane-wave' | 'spreading' | 'planar-interface';

/**
 * One store for the whole app. Per-module parameters live in slices keyed by
 * module; the time base (tau/playing/speed) is shared and stays flat so the
 * transient-subscription patterns keep working (docs/architecture.md).
 */
export interface WaveLabState {
  scene: SceneId;
  planeWave: PlaneWaveState;
  spreading: SpreadingState;
  /** Simulation time in periods (tau = t/T); phase survives frequency changes. */
  tau: number;
  playing: boolean;
  /** Playback rate in periods per second of wall time. */
  speed: number;
  /** Plane-wave probe position along z, in wavelengths. */
  probeZeta: number;
  /** Spreading-module radial probe, in wavelengths. */
  probeRho: number;
  setScene: (scene: SceneId) => void;
  setPlaneWaveParam: (key: keyof PlaneWaveState, value: number) => void;
  setSpreadingParam: (key: keyof SpreadingState, value: number) => void;
  setTau: (tau: number) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
  stepPhaseDeg: (deg: number) => void;
  setProbeZeta: (zeta: number) => void;
  setProbeRho: (rho: number) => void;
}

export const useWaveLabStore = create<WaveLabState>((set) => ({
  scene: 'plane-wave',
  planeWave: defaultPlaneWaveState,
  spreading: defaultSpreadingState,
  tau: 0,
  playing: true,
  speed: 0.25,
  probeZeta: 0.5,
  probeRho: 1,
  setScene: (scene) => set({ scene }),
  setPlaneWaveParam: (key, value) => set((s) => ({ planeWave: { ...s.planeWave, [key]: value } })),
  setSpreadingParam: (key, value) => set((s) => ({ spreading: { ...s.spreading, [key]: value } })),
  setTau: (tau) => set({ tau }),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  stepPhaseDeg: (deg) => set((s) => ({ tau: s.tau + deg / 360, playing: false })),
  setProbeZeta: (zeta) => set({ probeZeta: zeta }),
  setProbeRho: (rho) => set({ probeRho: rho }),
}));
