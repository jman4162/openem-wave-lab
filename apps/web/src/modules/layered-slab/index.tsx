import { layeredSlabModel, type LayeredSlabState } from '@openem/physics-core';
import { ParameterControls } from '../../components/ParameterControls';
import { SlabScene } from '../../render/scenes/slabScene';
import { useWaveLabStore } from '../../state/store';
import type { WaveModule } from '../types';
import { SlabEquations } from './SlabEquations';
import { SlabDiscreteControls, SlabSidebar } from './SlabSidebar';

function Controls() {
  const values = useWaveLabStore((s) => s.layeredSlab);
  const setParam = useWaveLabStore((s) => s.setSlabParam);
  return (
    <>
      <SlabDiscreteControls />
      <ParameterControls
        parameters={layeredSlabModel.parameters}
        values={values as unknown as Record<string, number>}
        onChange={(key, value) => setParam(key as keyof LayeredSlabState, value as never)}
      />
    </>
  );
}

export const layeredSlabModule: WaveModule = {
  id: 'layered-slab',
  title: 'Slab',
  legend: 'Heatmap: Ey (TE) / Hy (TM); slab between the white lines; k (amber), ⟨S⟩ (green)',
  createScene: (renderer, canvas) => new SlabScene(renderer, canvas),
  Controls,
  Sidebar: SlabSidebar,
  Equations: SlabEquations,
};
