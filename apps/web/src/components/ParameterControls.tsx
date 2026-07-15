import type { ParameterDefinition } from '@openem/physics-core';

export interface ParameterControlsProps {
  parameters: ParameterDefinition[];
  values: Record<string, number>;
  onChange: (key: string, value: number) => void;
  presets?: { label: string; values: Record<string, number> }[];
}

function formatValue(value: number, unit: string): string {
  if (unit === 'Hz') {
    if (value >= 1e12) return `${(value / 1e12).toFixed(2)} THz`;
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)} GHz`;
    return `${(value / 1e6).toFixed(1)} MHz`;
  }
  const text = Math.abs(value) >= 100 ? value.toFixed(0) : value.toPrecision(3);
  return unit ? `${text} ${unit}` : text;
}

/** Model-generic slider panel driven by ParameterDefinition metadata. */
export function ParameterControls({
  parameters,
  values,
  onChange,
  presets,
}: ParameterControlsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
      {presets && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                for (const [k, v] of Object.entries(p.values)) onChange(k, v);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
      {parameters.map((def) => {
        const value = values[def.key] ?? def.default;
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
              aria-label={def.label}
              onChange={(e) => {
                const raw = parseFloat(e.target.value);
                onChange(def.key, isLog ? 10 ** raw : raw);
              }}
            />
          </label>
        );
      })}
    </div>
  );
}
