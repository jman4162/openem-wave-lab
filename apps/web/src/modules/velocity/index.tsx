import { velocityModel, type VelocityState } from '@openem/physics-core';
import { ParameterControls } from '../../components/ParameterControls';
import { VelocityScene } from '../../render/scenes/velocityScene';
import { useWaveLabStore } from '../../state/store';
import type { WaveModule } from '../types';
import { VelocityEquations } from './VelocityEquations';
import { VelocitySidebar } from './VelocitySidebar';

const PRESETS = [
  { label: 'Strong dispersion', values: { cutoffFraction: 0.9 } },
  { label: 'Mild dispersion', values: { cutoffFraction: 0.4 } },
  { label: 'No dispersion', values: { cutoffFraction: 0 } },
];

function Controls() {
  const values = useWaveLabStore((s) => s.velocity);
  const setParam = useWaveLabStore((s) => s.setVelocityParam);
  return (
    <ParameterControls
      parameters={velocityModel.parameters}
      values={values as unknown as Record<string, number>}
      onChange={(key, value) => setParam(key as keyof VelocityState, value)}
      presets={PRESETS}
    />
  );
}

export const velocityModule: WaveModule = {
  id: 'velocities',
  title: 'Velocities',
  legend: 'ψ (red), envelope (gray) — amber crest at v_p, green envelope peak at v_g',
  createScene: (renderer, canvas) => new VelocityScene(renderer, canvas),
  Controls,
  Sidebar: VelocitySidebar,
  Equations: VelocityEquations,
};
