import { cadd, cmul, conj, csub, type Complex } from './complex';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ComplexVec3 {
  x: Complex;
  y: Complex;
  z: Complex;
}

export const vec3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

export const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

export const norm = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);

export const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });

/** Complex dot product without conjugation: sum of component products. */
export const cdotUnconjugated = (a: ComplexVec3, b: ComplexVec3): Complex =>
  cadd(cadd(cmul(a.x, b.x), cmul(a.y, b.y)), cmul(a.z, b.z));

/** Squared Euclidean magnitude: sum |a_i|^2. */
export const cnormSq = (a: ComplexVec3): number =>
  a.x.re * a.x.re +
  a.x.im * a.x.im +
  a.y.re * a.y.re +
  a.y.im * a.y.im +
  a.z.re * a.z.re +
  a.z.im * a.z.im;

/** Complex cross product a x b (no conjugation). */
export const ccross = (a: ComplexVec3, b: ComplexVec3): ComplexVec3 => ({
  x: csub(cmul(a.y, b.z), cmul(a.z, b.y)),
  y: csub(cmul(a.z, b.x), cmul(a.x, b.z)),
  z: csub(cmul(a.x, b.y), cmul(a.y, b.x)),
});

export const cconjVec = (a: ComplexVec3): ComplexVec3 => ({
  x: conj(a.x),
  y: conj(a.y),
  z: conj(a.z),
});
