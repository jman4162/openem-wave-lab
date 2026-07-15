import type { VelocityDerived } from './derive';

export interface VelocityFieldsAtPoint {
  /** Two-frequency beat: cos(k1 x - w1 t) + cos(k2 x - w2 t). */
  psiBeat: number;
  /** Beat envelope 2|cos((dk x - dw t)/2)|. */
  envelopeBeat: number;
  /** Gaussian pulse under quadratic dispersion (reduced-order). */
  psiPulse: number;
  envelopePulse: number;
}

/**
 * Instantaneous 1D fields at position x (m) and time t (s).
 *
 * Pulse closed form: with D = sigma_x^2 + i*omega'' t (complex width),
 *   psi = Re{ (sigma_x/sqrt(D)) e^{i(k0 x - w0 t)} exp(-(x - v_g t)^2 / (2D)) }
 * giving sigma(t) = sigma_x sqrt(1 + (omega'' t / sigma_x^2)^2).
 */
export function velocityFieldsAt(
  derived: VelocityDerived,
  x: number,
  t: number,
): VelocityFieldsAtPoint {
  const { omega1, omega2, k1, k2, deltaK, deltaOmega, omega, k, vG, gvd, sigmaXM } = derived;

  const psiBeat = Math.cos(k1 * x - omega1 * t) + Math.cos(k2 * x - omega2 * t);
  const envelopeBeat = 2 * Math.abs(Math.cos(0.5 * (deltaK * x - deltaOmega * t)));

  // Complex width D = sigma_x^2 + i*gvd*t.
  const dRe = sigmaXM * sigmaXM;
  const dIm = gvd * t;
  const dAbsSq = dRe * dRe + dIm * dIm;
  // A = sigma_x / sqrt(D): magnitude and phase.
  const dAbs = Math.sqrt(dAbsSq);
  const ampMag = sigmaXM / Math.sqrt(dAbs);
  const ampPhase = -0.5 * Math.atan2(dIm, dRe);
  // -(x - v_g t)^2 / (2D) = -u^2 (dRe - i dIm) / (2|D|^2)
  const u = x - vG * t;
  const expRe = (-u * u * dRe) / (2 * dAbsSq);
  const expIm = (u * u * dIm) / (2 * dAbsSq);
  const envelopePulse = ampMag * Math.exp(expRe);
  const phase = k * x - omega * t + expIm + ampPhase;
  const psiPulse = envelopePulse * Math.cos(phase);

  return { psiBeat, envelopeBeat, psiPulse, envelopePulse };
}

/** Pulse width law sigma(t) = sigma_x sqrt(1 + (omega'' t / sigma_x^2)^2). */
export function pulseWidthAt(derived: VelocityDerived, t: number): number {
  const ratio = (derived.gvd * t) / (derived.sigmaXM * derived.sigmaXM);
  return derived.sigmaXM * Math.sqrt(1 + ratio * ratio);
}
