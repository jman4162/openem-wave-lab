import type { ComplexVec3, Vec3 } from './math/vec3';

/**
 * Standard vector-field sample layout shared by EM models: instantaneous E/H
 * xyz-interleaved (3N) plus phasors re/im-interleaved per component (6N).
 */
export interface FieldSample {
  count: number;
  E: Float32Array;
  H: Float32Array;
  Ephasor: Float32Array;
  Hphasor: Float32Array;
}

export const allocFieldSample = (count: number): FieldSample => ({
  count,
  E: new Float32Array(3 * count),
  H: new Float32Array(3 * count),
  Ephasor: new Float32Array(6 * count),
  Hphasor: new Float32Array(6 * count),
});

const writeComplexVec = (out: Float32Array, i: number, v: ComplexVec3): void => {
  out[6 * i] = v.x.re;
  out[6 * i + 1] = v.x.im;
  out[6 * i + 2] = v.y.re;
  out[6 * i + 3] = v.y.im;
  out[6 * i + 4] = v.z.re;
  out[6 * i + 5] = v.z.im;
};

export function writeFieldSample(
  sample: FieldSample,
  i: number,
  fields: { E: Vec3; H: Vec3; Ephasor: ComplexVec3; Hphasor: ComplexVec3 },
): void {
  sample.E[3 * i] = fields.E.x;
  sample.E[3 * i + 1] = fields.E.y;
  sample.E[3 * i + 2] = fields.E.z;
  sample.H[3 * i] = fields.H.x;
  sample.H[3 * i + 1] = fields.H.y;
  sample.H[3 * i + 2] = fields.H.z;
  writeComplexVec(sample.Ephasor, i, fields.Ephasor);
  writeComplexVec(sample.Hphasor, i, fields.Hphasor);
}
