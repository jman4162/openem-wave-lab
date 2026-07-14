import { planeWaveModel, type PlaneWaveState } from '@openem/physics-core';
import { useWaveLabStore } from '../state/store';

const PRESETS: { label: string; values: Partial<PlaneWaveState> }[] = [
  { label: 'Linear x', values: { E0x: 1, E0y: 0, phaseYDeg: 0 } },
  { label: 'Linear 45°', values: { E0x: 1, E0y: 1, phaseYDeg: 0 } },
  { label: 'RHCP', values: { E0x: 1, E0y: 1, phaseYDeg: 90 } },
  { label: 'LHCP', values: { E0x: 1, E0y: 1, phaseYDeg: -90 } },
];

function formatValue(value: number, unit: string): string {
  if (unit === 'Hz') {
    if (value >= 1e12) return `${(value / 1e12).toFixed(2)} THz`;
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)} GHz`;
    return `${(value / 1e6).toFixed(1)} MHz`;
  }
  const text = Math.abs(value) >= 100 ? value.toFixed(0) : value.toPrecision(3);
  return unit ? `${text} ${unit}` : text;
}

export function ParameterControls() {
  const params = useWaveLabStore((s) => s.params);
  const setParam = useWaveLabStore((s) => s.setParam);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              for (const [k, v] of Object.entries(p.values)) {
                setParam(k as keyof PlaneWaveState, v);
              }
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      {planeWaveModel.parameters.map((def) => {
        const key = def.key as keyof PlaneWaveState;
        const value = params[key];
        const isLog = def.scale === 'log';
        const sliderValue = isLog ? Math.log10(value) : value;
        const sliderMin = isLog ? Math.log10(def.min) : def.min;
        const sliderMax = isLog ? Math.log10(def.max) : def.max;
        return (
          <label key={def.key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{def.label}</span>
              <span style={{ fontFamily: 'monospace' }}>{formatValue(value, def.unit)}</span>
            </span>
            <input
              type="range"
              min={sliderMin}
              max={sliderMax}
              step={(sliderMax - sliderMin) / 200}
              value={sliderValue}
              onChange={(e) => {
                const raw = parseFloat(e.target.value);
                setParam(key, isLog ? 10 ** raw : raw);
              }}
            />
          </label>
        );
      })}
    </div>
  );
}
