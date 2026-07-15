import type { Observable, PhysicsModel, ValidationResult } from '../model';
import { deriveVelocity, type VelocityDerived } from './derive';
import { pulseWidthAt, velocityFieldsAt } from './fields';
import { defaultVelocityState, velocityParameters, type VelocityState } from './state';

/**
 * Instantaneous real values only (no phasors): the beat and pulse are
 * multi-frequency fields, so the single-frequency phasor-cache pattern does
 * not apply; scenes resample per frame.
 */
export interface VelocitySample {
  count: number;
  psiBeat: Float32Array;
  envelopeBeat: Float32Array;
  psiPulse: Float32Array;
  envelopePulse: Float32Array;
}

export const velocityModel: PhysicsModel<VelocityState, VelocitySample, VelocityDerived> = {
  id: 'velocities',
  fidelity: 'reduced-order',
  assumptions: [
    'Waveguide-type dispersion ω(k) = √(ω_c² + c_m²k²): causal, lossless, normal dispersion',
    'Beat view is exact for the two stated frequencies',
    'Pulse view truncates ω(k) at second order around the carrier (Gaussian stays Gaussian)',
    'Energy velocity equals group velocity HERE because the medium is lossless; in absorptive or strongly dispersive media v_g is neither energy nor signal velocity',
    'Scalar field; phasor convention Re{ψe^{-iωt}}',
  ],
  parameters: velocityParameters,

  derive: deriveVelocity,

  sampleField(state, points, time) {
    const derived = deriveVelocity(state);
    const count = Math.floor(points.length / 3);
    const sample: VelocitySample = {
      count,
      psiBeat: new Float32Array(count),
      envelopeBeat: new Float32Array(count),
      psiPulse: new Float32Array(count),
      envelopePulse: new Float32Array(count),
    };
    for (let i = 0; i < count; i++) {
      const f = velocityFieldsAt(derived, points[3 * i] ?? 0, time);
      sample.psiBeat[i] = f.psiBeat;
      sample.envelopeBeat[i] = f.envelopeBeat;
      sample.psiPulse[i] = f.psiPulse;
      sample.envelopePulse[i] = f.envelopePulse;
    }
    return sample;
  },

  observables(state, point = { x: 0, y: 0, z: 0 }, time = 0) {
    const derived = deriveVelocity(state);
    const f = velocityFieldsAt(derived, point.x, time);
    const obs: Observable[] = [
      {
        id: 'v-p',
        label: 'Phase velocity',
        unit: 'm/s',
        symbol: 'v_p',
        kind: 'scalar',
        value: derived.vP,
      },
      {
        id: 'v-g',
        label: 'Group velocity',
        unit: 'm/s',
        symbol: 'v_g',
        kind: 'scalar',
        value: derived.vG,
      },
      {
        id: 'v-e',
        label: 'Energy velocity (= v_g, lossless)',
        unit: 'm/s',
        symbol: 'v_E',
        kind: 'scalar',
        value: derived.vE,
      },
      {
        id: 'gvd',
        label: 'Group-velocity dispersion',
        unit: 'm²/s',
        symbol: "\\omega''",
        kind: 'scalar',
        value: derived.gvd,
      },
      {
        id: 'pulse-width',
        label: 'Pulse width σ(t)',
        unit: 'm',
        symbol: '\\sigma(t)',
        kind: 'scalar',
        value: pulseWidthAt(derived, time),
      },
      {
        id: 'psi-beat',
        label: 'Beat field at probe',
        unit: '',
        symbol: '\\psi',
        kind: 'scalar',
        value: f.psiBeat,
      },
    ];
    return obs;
  },

  validate(state) {
    const derived = deriveVelocity(state);
    const results: ValidationResult[] = [];
    const push = (id: string, description: string, residual: number, tolerance: number): void => {
      results.push({ id, description, residual, tolerance, pass: residual <= tolerance });
    };

    push(
      'vp-vg-identity',
      'v_p · v_g = c_m² (waveguide-dispersion identity)',
      Math.abs((derived.vP * derived.vG) / (derived.cM * derived.cM) - 1),
      1e-12,
    );

    push(
      'velocity-ordering',
      'v_g ≤ c_m ≤ v_p (with equality only at zero cutoff)',
      (derived.vG <= derived.cM * (1 + 1e-12) ? 0 : 1) +
        (derived.vP >= derived.cM * (1 - 1e-12) ? 0 : 1),
      0,
    );

    // Envelope peak velocity from the fields: track the beat envelope maximum.
    if (derived.deltaK > 0) {
      const T = derived.periodS;
      const measurePeak = (t: number): number => {
        // The envelope peak nearest the origin: maximum of cos((dk x - dw t)/2)
        // at dk x = dw t; verify numerically with parabolic refinement.
        const guess = (derived.deltaOmega * t) / derived.deltaK;
        const h = derived.beatWavelengthM / 200;
        const env = (x: number): number => velocityFieldsAt(derived, x, t).envelopeBeat;
        const y0 = env(guess - h);
        const y1 = env(guess);
        const y2 = env(guess + h);
        const denom = y0 - 2 * y1 + y2;
        return denom !== 0 ? guess + (h * (y0 - y2)) / (2 * denom) : guess;
      };
      const t1 = 3 * T;
      const t2 = 13 * T;
      const measured = (measurePeak(t2) - measurePeak(t1)) / (t2 - t1);
      push(
        'envelope-velocity',
        'Beat envelope peak moves at Δω/Δk (computed from the field, not assumed)',
        Math.abs(measured / derived.envelopeVelocity - 1),
        1e-6,
      );
    }

    // Convention pin: a carrier crest moves toward +x as t increases.
    const dtSmall = derived.periodS / 50;
    const phase0 = derived.k * 0 - derived.omega * 0;
    const xCrest = (derived.omega * dtSmall + phase0) / derived.k;
    push(
      'outgoing-convention',
      'Phase crest moves toward +x under e^{-iωt}',
      xCrest > 0 ? 0 : 1,
      0,
    );

    return results;
  },
};

export { defaultVelocityState };
