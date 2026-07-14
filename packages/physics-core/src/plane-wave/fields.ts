import { cdiv, cmul, cexp, cscale, expi, complex, type Complex } from '../math/complex';
import type { ComplexVec3, Vec3 } from '../math/vec3';
import type { PlaneWaveDerived } from './derive';
import type { PlaneWaveState } from './state';

export interface FieldsAtPoint {
  /** Phasor E~(z), V/m. */
  Ephasor: ComplexVec3;
  /** Phasor H~(z) = (1/eta) z^ x E~, A/m. */
  Hphasor: ComplexVec3;
  /** Instantaneous E = Re{E~ e^{-i omega t}}, V/m. */
  E: Vec3;
  /** Instantaneous H, A/m. */
  H: Vec3;
}

const instantaneous = (phasor: Complex, phase: Complex): number =>
  phasor.re * phase.re - phasor.im * phase.im;

/**
 * Double-precision field evaluation at height z (m) and time t (s).
 * E~(z) = (E0x x^ + E0y e^{i delta} y^) e^{ikz};
 * z^ x (Ex x^ + Ey y^) = -Ey x^ + Ex y^.
 */
export function fieldsAt(
  state: PlaneWaveState,
  derived: PlaneWaveDerived,
  z: number,
  t: number,
): FieldsAtPoint {
  const { k, eta, omega } = derived;
  // e^{ikz} = e^{-alpha z} e^{i beta z}
  const propagator = cexp(complex(-k.im * z, k.re * z));
  const Ex = cscale(propagator, state.E0x);
  const Ey = cmul(cscale(expi((state.phaseYDeg * Math.PI) / 180), state.E0y), propagator);
  const zero = complex(0);

  const Hx = cdiv(cscale(Ey, -1), eta);
  const Hy = cdiv(Ex, eta);

  // e^{-i omega t}
  const timePhase = expi(-omega * t);

  return {
    Ephasor: { x: Ex, y: Ey, z: zero },
    Hphasor: { x: Hx, y: Hy, z: zero },
    E: { x: instantaneous(Ex, timePhase), y: instantaneous(Ey, timePhase), z: 0 },
    H: { x: instantaneous(Hx, timePhase), y: instantaneous(Hy, timePhase), z: 0 },
  };
}
