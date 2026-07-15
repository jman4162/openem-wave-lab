import type { Observable, PhysicsModel, ValidationResult } from '../model';
import {
  deriveStandingWave,
  standingWaveEnvelopeAt,
  standingWaveFluxAt,
  standingWavePhasorAt,
  type StandingWaveDerived,
} from './fields';
import { defaultStandingWaveState, standingWaveParameters, type StandingWaveState } from './state';

/** Single-frequency field: phasors only (2N re/im); scenes rotate by e^{-i omega t}. */
export interface StandingWaveSample {
  count: number;
  Ephasor: Float32Array;
}

export const standingWaveModel: PhysicsModel<
  StandingWaveState,
  StandingWaveSample,
  StandingWaveDerived
> = {
  id: 'standing-waves',
  fidelity: 'exact',
  assumptions: [
    'Lossless 1D superposition of a forward wave and one reflection (termination at z = 0)',
    'Time-harmonic steady state, phasor convention Re{E~ e^{-iωt}}',
    'Scalar transverse field; termination physics enters only through Γ',
    'Two-source interference and beats live elsewhere: beats in the Velocities module; 2D two-source is planned',
  ],
  parameters: standingWaveParameters,

  derive: deriveStandingWave,

  sampleField(state, points, _time) {
    const derived = deriveStandingWave(state);
    const count = Math.floor(points.length / 3);
    const sample: StandingWaveSample = { count, Ephasor: new Float32Array(2 * count) };
    for (let i = 0; i < count; i++) {
      const psi = standingWavePhasorAt(state, derived, points[3 * i + 2] ?? 0);
      sample.Ephasor[2 * i] = psi.re;
      sample.Ephasor[2 * i + 1] = psi.im;
    }
    return sample;
  },

  observables(state, point = { x: 0, y: 0, z: 0 }, time = 0) {
    const derived = deriveStandingWave(state);
    const psi = standingWavePhasorAt(state, derived, point.z);
    const instantaneous =
      psi.re * Math.cos(derived.omega * time) + psi.im * Math.sin(derived.omega * time);
    const obs: Observable[] = [
      {
        id: 'E-inst',
        label: 'Instantaneous E at probe (oscillates)',
        unit: 'V/m',
        symbol: 'E(z_p,t)',
        kind: 'scalar',
        value: instantaneous,
      },
      {
        id: 'envelope',
        label: 'Envelope |E~| at probe (fixed)',
        unit: 'V/m',
        symbol: '|\\tilde{E}|',
        kind: 'scalar',
        value: standingWaveEnvelopeAt(state, derived, point.z),
      },
      {
        id: 'intensity-avg',
        label: 'Time-averaged intensity ∝ |E~|²/2 (fixed)',
        unit: 'V²/m²',
        symbol: '\\langle E^2\\rangle',
        kind: 'scalar',
        value: 0.5 * standingWaveEnvelopeAt(state, derived, point.z) ** 2,
      },
      {
        id: 'net-flux',
        label: 'Net flux / forward flux (from the field)',
        unit: '',
        symbol: '1-|\\Gamma|^2',
        kind: 'scalar',
        value: standingWaveFluxAt(state, derived, point.z),
      },
    ];
    return obs;
  },

  validate(state) {
    const derived = deriveStandingWave(state);
    const results: ValidationResult[] = [];
    const push = (id: string, description: string, residual: number, tolerance: number): void => {
      results.push({ id, description, residual, tolerance, pass: residual <= tolerance });
    };
    const g = state.gammaMag;

    // Envelope extrema against SWR (numeric sweep vs closed form).
    let envMax = 0;
    let envMin = Infinity;
    const lambda = derived.wavelengthM;
    for (let i = 0; i <= 800; i++) {
      const z = -lambda + (lambda * i) / 800;
      const e = standingWaveEnvelopeAt(state, derived, z);
      envMax = Math.max(envMax, e);
      envMin = Math.min(envMin, e);
    }
    // Sweep extrema carry O((k dz)^2) sampling error at 800 points/lambda.
    push(
      'envelope-max',
      'Swept envelope maximum equals E0(1+|Γ|)',
      Math.abs(envMax / derived.envelopeMaxV - 1),
      1e-4,
    );
    if (g < 1) {
      push(
        'swr',
        'Envelope max/min equals the SWR',
        Math.abs(envMax / envMin / derived.swr - 1),
        1e-4,
      );
    } else {
      push('full-reflection-null', '|Γ| = 1 gives true nulls', envMin / envMax, 1e-4);
    }

    // Minima at the analytic positions, spaced lambda/2.
    push(
      'first-minimum',
      'Envelope minimum at the analytic position',
      Math.abs(standingWaveEnvelopeAt(state, derived, derived.firstMinZM) / state.E0 - (1 - g)),
      1e-9,
    );
    push(
      'node-spacing',
      'Adjacent minima are λ/2 apart',
      Math.abs(
        standingWaveEnvelopeAt(state, derived, derived.firstMinZM - derived.nodeSpacingM) /
          state.E0 -
          (1 - g),
      ),
      1e-9,
    );

    // Conservation: flux computed from the field is z-independent = 1-|Γ|².
    for (const [i, z] of [-0.13 * lambda, -0.77 * lambda].entries()) {
      push(
        `net-flux-${i}`,
        'Im{E~* ∂z E~}/(k E0²) = 1 − |Γ|² at any z (conservation)',
        Math.abs(standingWaveFluxAt(state, derived, z) - derived.netFluxNorm),
        1e-9,
      );
    }

    // Convention pin: with Γ = 0 the phase increases with z (forward wave).
    const forwardOnly: StandingWaveState = { ...state, gammaMag: 0 };
    const dForward = deriveStandingWave(forwardOnly);
    const p1 = standingWavePhasorAt(forwardOnly, dForward, -0.3 * lambda);
    const p2 = standingWavePhasorAt(forwardOnly, dForward, -0.3 * lambda + lambda / 100);
    const dPhase = Math.atan2(p2.im, p2.re) - Math.atan2(p1.im, p1.re);
    const wrapped = ((dPhase + Math.PI) % (2 * Math.PI)) - Math.PI;
    push('outgoing-convention', 'Forward wave phase increases with z', wrapped > 0 ? 0 : 1, 0);

    return results;
  },
};

export { defaultStandingWaveState };
