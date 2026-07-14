import type { Complex } from './math/complex';
import type { ComplexVec3, Vec3 } from './math/vec3';

export type Fidelity = 'exact' | 'analytic' | 'reduced-order' | 'numerical' | 'conceptual';

export interface ParameterDefinition {
  key: string;
  label: string;
  unit: string;
  /** LaTeX symbol, consumed by the equation panel. */
  symbol: string;
  min: number;
  max: number;
  default: number;
  scale: 'linear' | 'log';
}

export type ObservableValue =
  | { kind: 'scalar'; value: number }
  | { kind: 'complex'; value: Complex }
  | { kind: 'vec3'; value: Vec3 }
  | { kind: 'complex-vec3'; value: ComplexVec3 };

export type Observable = {
  id: string;
  label: string;
  unit: string;
  symbol: string;
} & ObservableValue;

export interface ValidationResult {
  id: string;
  description: string;
  residual: number;
  tolerance: number;
  pass: boolean;
}

/**
 * Contract between a physics model and everything downstream (rendering, UI,
 * validation). The renderer consumes sampleField/observables generically and
 * never embeds model-specific formulas.
 */
export interface PhysicsModel<State, Sample, Derived> {
  id: string;
  fidelity: Fidelity;
  assumptions: string[];
  parameters: ParameterDefinition[];
  derive(state: State): Derived;
  /** Instantaneous and phasor fields at xyz-interleaved points (meters), time in seconds. */
  sampleField(state: State, points: Float32Array, time: number): Sample;
  observables(state: State, point?: Vec3, time?: number): Observable[];
  validate(state: State): ValidationResult[];
}
