import { create } from 'zustand';
import {
  defaultPlanarInterfaceState,
  defaultPlaneWaveState,
  defaultSpreadingState,
  type PlanarInterfaceState,
  type PlaneWaveState,
  type SpreadingState,
} from '@openem/physics-core';

export type SceneId = 'plane-wave' | 'spreading' | 'planar-interface';

export type SpreadingViewKind = 'plane' | 'cylindrical' | 'spherical';

/**
 * One store for the whole app. Per-module parameters live in slices keyed by
 * module; the time base (tau/playing/speed) is shared and stays flat so the
 * transient-subscription patterns keep working (docs/architecture.md).
 */
export interface WaveLabState {
  scene: SceneId;
  planeWave: PlaneWaveState;
  spreading: SpreadingState;
  planarInterface: PlanarInterfaceState;
  /** Simulation time in periods (tau = t/T); phase survives frequency changes. */
  tau: number;
  playing: boolean;
  /** Playback rate in periods per second of wall time. */
  speed: number;
  /** Plane-wave probe position along z, in wavelengths. */
  probeZeta: number;
  /** Spreading-module radial probe, in wavelengths. */
  probeRho: number;
  /** Interface-module probe, in medium-1 wavelengths (z < 0 is medium 1). */
  probeX: number;
  probeZ: number;
  /** Wave kind shown in the spreading module's single view. */
  spreadingKind: SpreadingViewKind;
  /** Side-by-side plane/cylindrical/spherical comparison. */
  spreadingCompare: boolean;
  /** Show |psi| envelope instead of instantaneous Re{psi}. */
  spreadingEnvelope: boolean;
  /** Log-log radial plots. */
  spreadingLogPlot: boolean;
  setScene: (scene: SceneId) => void;
  setPlaneWaveParam: (key: keyof PlaneWaveState, value: number) => void;
  setSpreadingParam: (key: keyof SpreadingState, value: number) => void;
  setInterfaceParam: <K extends keyof PlanarInterfaceState>(
    key: K,
    value: PlanarInterfaceState[K],
  ) => void;
  setTau: (tau: number) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
  stepPhaseDeg: (deg: number) => void;
  setProbeZeta: (zeta: number) => void;
  setProbeRho: (rho: number) => void;
  setProbeX: (x: number) => void;
  setProbeZ: (z: number) => void;
  setSpreadingKind: (kind: SpreadingViewKind) => void;
  setSpreadingCompare: (compare: boolean) => void;
  setSpreadingEnvelope: (envelope: boolean) => void;
  setSpreadingLogPlot: (log: boolean) => void;
}

export const useWaveLabStore = create<WaveLabState>((set) => ({
  scene: 'plane-wave',
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
  setScene: (scene) => set({ scene }),
  setPlaneWaveParam: (key, value) => set((s) => ({ planeWave: { ...s.planeWave, [key]: value } })),
  setSpreadingParam: (key, value) => set((s) => ({ spreading: { ...s.spreading, [key]: value } })),
  setInterfaceParam: (key, value) =>
    set((s) => ({ planarInterface: { ...s.planarInterface, [key]: value } })),
  setTau: (tau) => set({ tau }),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  stepPhaseDeg: (deg) => set((s) => ({ tau: s.tau + deg / 360, playing: false })),
  setProbeZeta: (zeta) => set({ probeZeta: zeta }),
  setProbeRho: (rho) => set({ probeRho: rho }),
  setProbeX: (probeX) => set({ probeX }),
  setProbeZ: (probeZ) => set({ probeZ }),
  setSpreadingKind: (spreadingKind) => set({ spreadingKind }),
  setSpreadingCompare: (spreadingCompare) => set({ spreadingCompare }),
  setSpreadingEnvelope: (spreadingEnvelope) => set({ spreadingEnvelope }),
  setSpreadingLogPlot: (spreadingLogPlot) => set({ spreadingLogPlot }),
}));
