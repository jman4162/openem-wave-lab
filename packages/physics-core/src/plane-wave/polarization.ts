export interface PolarizationState {
  type: 'linear' | 'circular' | 'elliptical';
  /**
   * IEEE handedness (right-hand rule with thumb along propagation).
   * Null for linear polarization.
   */
  handedness: 'RH' | 'LH' | null;
  /** Major-to-minor axis ratio; 1 for circular, Infinity for linear. */
  axialRatio: number;
  /** Tilt of the ellipse major axis from +x, degrees, in (-90, 90]. */
  tiltDeg: number;
}

const CIRC_TOL = 1e-9;

/**
 * Classify the polarization of E~ = (a x^ + b e^{i delta} y^) e^{ikz} under
 * e^{-i omega t}. Uses Stokes parameters: with this convention the
 * instantaneous field is a x^ cos(wt) + b y^ cos(wt - delta), so S3 > 0
 * (delta in (0, 180 deg)) rotates +x toward +y, which is IEEE right-handed
 * for +z propagation (see docs/physics-conventions.md).
 */
export function classifyPolarization(a: number, b: number, deltaDeg: number): PolarizationState {
  const delta = (deltaDeg * Math.PI) / 180;
  const s0 = a * a + b * b;
  if (s0 === 0) {
    return { type: 'linear', handedness: null, axialRatio: Infinity, tiltDeg: 0 };
  }
  const s1 = a * a - b * b;
  const s2 = 2 * a * b * Math.cos(delta);
  const s3 = 2 * a * b * Math.sin(delta);

  const tiltDeg = (0.5 * Math.atan2(s2, s1) * 180) / Math.PI;
  // |s3|/s0 = sin(2*chi); tan(chi) = minor/major.
  const chi = 0.5 * Math.asin(Math.min(1, Math.max(-1, s3 / s0)));
  const tanChi = Math.abs(Math.tan(chi));

  if (tanChi < CIRC_TOL) {
    return { type: 'linear', handedness: null, axialRatio: Infinity, tiltDeg };
  }
  const axialRatio = 1 / tanChi;
  const handedness = s3 > 0 ? 'RH' : 'LH';
  if (Math.abs(axialRatio - 1) < CIRC_TOL) {
    return { type: 'circular', handedness, axialRatio: 1, tiltDeg };
  }
  return { type: 'elliptical', handedness, axialRatio, tiltDeg };
}
