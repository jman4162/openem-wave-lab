import { describe, expect, it } from 'vitest';
import { cabs, carg, cdiv, cexp, cmul, complex, csqrt, expi } from '@openem/physics-core';

describe('complex arithmetic', () => {
  it('multiplies and divides consistently', () => {
    const a = complex(2, 3);
    const b = complex(-1, 4);
    const q = cdiv(cmul(a, b), b);
    expect(q.re).toBeCloseTo(a.re, 12);
    expect(q.im).toBeCloseTo(a.im, 12);
  });

  it('cexp matches Euler for imaginary argument', () => {
    const z = cexp(complex(0, Math.PI / 3));
    expect(z.re).toBeCloseTo(0.5, 12);
    expect(z.im).toBeCloseTo(Math.sqrt(3) / 2, 12);
    const w = expi(Math.PI / 3);
    expect(w.re).toBeCloseTo(z.re, 15);
    expect(w.im).toBeCloseTo(z.im, 15);
  });

  it('csqrt takes the principal branch (Re >= 0)', () => {
    // Upper half plane -> first quadrant (passive-media branch).
    const s = csqrt(complex(0, 1));
    expect(s.re).toBeGreaterThan(0);
    expect(s.im).toBeGreaterThan(0);
    expect(cabs(cmul(s, s))).toBeCloseTo(1, 12);
    expect(carg(cmul(s, s))).toBeCloseTo(Math.PI / 2, 12);

    const n = csqrt(complex(-4, 0));
    expect(n.re).toBeCloseTo(0, 12);
    expect(Math.abs(n.im)).toBeCloseTo(2, 12);
  });
});
