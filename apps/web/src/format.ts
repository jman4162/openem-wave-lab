import { cabs, carg, type Complex } from '@openem/physics-core';

const PREFIXES: [number, string][] = [
  [1e12, 'T'],
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'µ'],
  [1e-9, 'n'],
  [1e-12, 'p'],
  [1e-15, 'f'],
];

/** Engineering notation with SI prefix, e.g. 2.09e-6 m -> "2.09 µm". */
export function formatSI(value: number, unit: string, digits = 3): string {
  if (value === 0) return `0 ${unit}`;
  if (!Number.isFinite(value)) return `${value > 0 ? '∞' : '−∞'} ${unit}`;
  const abs = Math.abs(value);
  const entry = PREFIXES.find(([scale]) => abs >= scale) ?? PREFIXES[PREFIXES.length - 1];
  if (!entry) return `${value.toPrecision(digits)} ${unit}`;
  const [scale, prefix] = entry;
  return `${(value / scale).toPrecision(digits)} ${prefix}${unit}`;
}

/** Polar form "mag ∠ phase°". */
export function formatComplex(z: Complex, unit: string, digits = 3): string {
  const degrees = (carg(z) * 180) / Math.PI;
  return `${formatSI(cabs(z), unit, digits)} ∠ ${degrees.toFixed(1)}°`;
}
