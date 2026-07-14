import { planeWaveModel, type PlaneWaveState } from '@openem/physics-core';
import { ParameterControls } from '../../components/ParameterControls';
import { PlaneWaveScene } from '../../render/scenes/planeWaveScene';
import { useWaveLabStore } from '../../state/store';
import type { WaveModule } from '../types';
import { PlaneWaveEquations } from './PlaneWaveEquations';
import { PolarizationEllipse } from './PolarizationEllipse';
import { ProbeReadout } from './ProbeReadout';

const PRESETS = [
  { label: 'Linear x', values: { E0x: 1, E0y: 0, phaseYDeg: 0 } },
  { label: 'Linear 45°', values: { E0x: 1, E0y: 1, phaseYDeg: 0 } },
  { label: 'RHCP', values: { E0x: 1, E0y: 1, phaseYDeg: 90 } },
  { label: 'LHCP', values: { E0x: 1, E0y: 1, phaseYDeg: -90 } },
];

function Controls() {
  const values = useWaveLabStore((s) => s.planeWave);
  const setParam = useWaveLabStore((s) => s.setPlaneWaveParam);
  return (
    <ParameterControls
      parameters={planeWaveModel.parameters}
      values={values as unknown as Record<string, number>}
      onChange={(key, value) => setParam(key as keyof PlaneWaveState, value)}
      presets={PRESETS}
    />
  );
}

function Sidebar() {
  return (
    <>
      <ProbeReadout />
      <PolarizationEllipse />
    </>
  );
}

export const planeWaveModule: WaveModule = {
  id: 'plane-wave',
  title: 'Plane wave',
  legend: 'E (red), η₀H (blue), k (amber)',
  createScene: (renderer, canvas) => new PlaneWaveScene(renderer, canvas),
  Controls,
  Sidebar,
  Equations: PlaneWaveEquations,
};
