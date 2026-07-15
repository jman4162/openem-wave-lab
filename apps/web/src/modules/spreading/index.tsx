import { spreadingModel, type SpreadingState } from '@openem/physics-core';
import { ParameterControls } from '../../components/ParameterControls';
import { SpreadingScene } from '../../render/scenes/spreadingScene';
import { useWaveLabStore } from '../../state/store';
import type { WaveModule } from '../types';
import { SpreadingEquations } from './SpreadingEquations';
import { SpreadingSidebar } from './SpreadingSidebar';

function Controls() {
  const values = useWaveLabStore((s) => s.spreading);
  const setParam = useWaveLabStore((s) => s.setSpreadingParam);
  return (
    <ParameterControls
      parameters={spreadingModel.parameters}
      values={values as unknown as Record<string, number>}
      onChange={(key, value) => setParam(key as keyof SpreadingState, value)}
    />
  );
}

export const spreadingModule: WaveModule = {
  id: 'spreading',
  title: 'Wave spreading',
  legend: 'Re{ψ} heatmap — source at center, plane wave along +x',
  createScene: (renderer, canvas) => new SpreadingScene(renderer, canvas),
  Controls,
  Sidebar: SpreadingSidebar,
  Equations: SpreadingEquations,
};
