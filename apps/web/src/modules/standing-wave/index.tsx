import { standingWaveModel, type StandingWaveState } from '@openem/physics-core';
import { ParameterControls } from '../../components/ParameterControls';
import { StandingWaveScene } from '../../render/scenes/standingWaveScene';
import { useWaveLabStore } from '../../state/store';
import type { WaveModule } from '../types';
import { StandingWaveEquations } from './StandingWaveEquations';
import { StandingWaveSidebar } from './StandingWaveSidebar';

const PRESETS = [
  { label: 'Short', values: { gammaMag: 1, gammaPhaseDeg: 180 } },
  { label: 'Open', values: { gammaMag: 1, gammaPhaseDeg: 0 } },
  { label: 'Matched', values: { gammaMag: 0, gammaPhaseDeg: 0 } },
  { label: 'Partial', values: { gammaMag: 0.5, gammaPhaseDeg: 180 } },
];

function Controls() {
  const values = useWaveLabStore((s) => s.standingWave);
  const setParam = useWaveLabStore((s) => s.setStandingWaveParam);
  return (
    <ParameterControls
      parameters={standingWaveModel.parameters}
      values={values as unknown as Record<string, number>}
      onChange={(key, value) => setParam(key as keyof StandingWaveState, value)}
      presets={PRESETS}
    />
  );
}

export const standingWaveModule: WaveModule = {
  id: 'standing-waves',
  title: 'Standing waves',
  legend: 'E(z,t) (red), |Ẽ| envelope (gray), ⟨E²⟩ on its own baseline (blue) — wall at right',
  createScene: (renderer, canvas) => new StandingWaveScene(renderer, canvas),
  Controls,
  Sidebar: StandingWaveSidebar,
  Equations: StandingWaveEquations,
};
