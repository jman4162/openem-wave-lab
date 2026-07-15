/** 256-entry RGBA lookup tables for field heatmaps. */

type Anchor = [number, number, number];

function makeLut(anchors: Anchor[]): Uint8Array {
  const lut = new Uint8Array(256 * 4);
  const segments = anchors.length - 1;
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * segments;
    const seg = Math.min(Math.floor(t), segments - 1);
    const frac = t - seg;
    const a = anchors[seg] ?? [0, 0, 0];
    const b = anchors[seg + 1] ?? a;
    lut[4 * i] = Math.round(255 * (a[0] + (b[0] - a[0]) * frac));
    lut[4 * i + 1] = Math.round(255 * (a[1] + (b[1] - a[1]) * frac));
    lut[4 * i + 2] = Math.round(255 * (a[2] + (b[2] - a[2]) * frac));
    lut[4 * i + 3] = 255;
  }
  return lut;
}

/** Moreland cool-warm diverging map for signed instantaneous fields (zero = neutral). */
export const DIVERGING_LUT = makeLut([
  [0.23, 0.299, 0.754],
  [0.865, 0.865, 0.865],
  [0.706, 0.016, 0.15],
]);

/** Viridis-like sequential map for magnitudes/envelopes. */
export const SEQUENTIAL_LUT = makeLut([
  [0.267, 0.005, 0.329],
  [0.229, 0.322, 0.545],
  [0.128, 0.567, 0.551],
  [0.369, 0.789, 0.383],
  [0.993, 0.906, 0.144],
]);
