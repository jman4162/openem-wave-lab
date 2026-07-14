import type { SceneId } from '../state/store';
import { planeWaveModule } from './plane-wave';
import type { WaveModule } from './types';

export const MODULES: WaveModule[] = [planeWaveModule];

export const getModule = (id: SceneId): WaveModule =>
  MODULES.find((m) => m.id === id) ?? planeWaveModule;
