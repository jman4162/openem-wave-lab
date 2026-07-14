import { create } from 'zustand';
import { defaultPlaneWaveState, type PlaneWaveState } from '@openem/physics-core';

export interface WaveLabState {
  params: PlaneWaveState;
  /**
   * Simulation time in periods (dimensionless tau = t/T). Physical time is
   * tau * T. Storing periods keeps the phase stable when frequency changes.
   */
  tau: number;
  playing: boolean;
  /** Playback rate in periods per second of wall time. */
  speed: number;
  /** Probe position along the propagation axis, in wavelengths. */
  probeZeta: number;
  setParam: (key: keyof PlaneWaveState, value: number) => void;
  setTau: (tau: number) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
  stepPhaseDeg: (deg: number) => void;
  setProbeZeta: (zeta: number) => void;
}

export const useWaveLabStore = create<WaveLabState>((set) => ({
  params: defaultPlaneWaveState,
  tau: 0,
  playing: true,
  speed: 0.25,
  probeZeta: 0.5,
  setParam: (key, value) => set((s) => ({ params: { ...s.params, [key]: value } })),
  setTau: (tau) => set({ tau }),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  stepPhaseDeg: (deg) => set((s) => ({ tau: s.tau + deg / 360, playing: false })),
  setProbeZeta: (zeta) => set({ probeZeta: zeta }),
}));
