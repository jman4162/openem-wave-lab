import type { SceneId } from '../state/store';
import { planarInterfaceModule } from './planar-interface';
import { planeWaveModule } from './plane-wave';
import { spreadingModule } from './spreading';
import { standingWaveModule } from './standing-wave';
import { velocityModule } from './velocity';
import type { WaveModule } from './types';

export const MODULES: WaveModule[] = [
  planeWaveModule,
  spreadingModule,
  planarInterfaceModule,
  velocityModule,
  standingWaveModule,
];

export const getModule = (id: SceneId): WaveModule =>
  MODULES.find((m) => m.id === id) ?? planeWaveModule;
