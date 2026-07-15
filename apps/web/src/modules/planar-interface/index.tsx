import { planarInterfaceModel, type PlanarInterfaceState } from '@openem/physics-core';
import { ParameterControls } from '../../components/ParameterControls';
import { InterfaceScene } from '../../render/scenes/interfaceScene';
import { useWaveLabStore } from '../../state/store';
import type { WaveModule } from '../types';
import { InterfaceEquations } from './InterfaceEquations';
import { InterfaceDiscreteControls, InterfaceSidebar } from './InterfaceSidebar';

function Controls() {
  const values = useWaveLabStore((s) => s.planarInterface);
  const setParam = useWaveLabStore((s) => s.setInterfaceParam);
  return (
    <>
      <InterfaceDiscreteControls />
      <ParameterControls
        parameters={planarInterfaceModel.parameters}
        values={values as unknown as Record<string, number>}
        onChange={(key, value) => setParam(key as keyof PlanarInterfaceState, value as never)}
      />
    </>
  );
}

export const planarInterfaceModule: WaveModule = {
  id: 'planar-interface',
  title: 'Interface',
  legend: 'Heatmap: Ey (TE) / Hy (TM) — medium 1 below, medium 2 above; k (amber), ⟨S⟩ (green)',
  createScene: (renderer, canvas) => new InterfaceScene(renderer, canvas),
  Controls,
  Sidebar: InterfaceSidebar,
  Equations: InterfaceEquations,
};
