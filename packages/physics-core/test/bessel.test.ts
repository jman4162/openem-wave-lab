import { describe, expect, it } from 'vitest';
import {
  besselJ0,
  besselJ1,
  besselY0,
  besselY1,
  cabs,
  carg,
  hankel1_0,
} from '@openem/physics-core';

describe('Bessel function values (Abramowitz & Stegun tables)', () => {
  const cases: [string, (x: number) => number, number, number][] = [
    ['J0(1)', besselJ0, 1, 0.7651976866],
    ['J0(2)', besselJ0, 2, 0.2238907791],
    ['J0(5)', besselJ0, 5, -0.1775967713],
    ['J1(1)', besselJ1, 1, 0.4400505857],
    ['J1(2)', besselJ1, 2, 0.5767248078],
    ['J1(5)', besselJ1, 5, -0.3275791376],
    ['Y0(1)', besselY0, 1, 0.0882569642],
    ['Y0(2)', besselY0, 2, 0.5103756726],
    ['Y0(5)', besselY0, 5, -0.3085176252],
    ['Y1(1)', besselY1, 1, -0.7812128213],
    ['Y1(2)', besselY1, 2, -0.1070324315],
    ['Y1(5)', besselY1, 5, 0.1478631434],
  ];
  for (const [name, fn, x, expected] of cases) {
    it(`${name} = ${expected}`, () => {
      expect(fn(x)).toBeCloseTo(expected, 7);
    });
  }

  it('first zeros: J0 at 2.40482556, Y0 at 0.89357697', () => {
    expect(Math.abs(besselJ0(2.4048255577))).toBeLessThan(1e-7);
    expect(Math.abs(besselY0(0.8935769663))).toBeLessThan(1e-7);
  });

  it('J0(0) = 1, J1(0) = 0; Y diverges (NaN guard) at x <= 0', () => {
    expect(besselJ0(0)).toBe(1);
    expect(besselJ1(0)).toBe(0);
    expect(besselY0(0)).toBeNaN();
    expect(besselY1(-1)).toBeNaN();
  });
});

describe('Wronskian identity J1*Y0 - J0*Y1 = 2/(pi x)', () => {
  it('holds across the domain including the x=3 branch switch', () => {
    for (const x of [0.1, 0.3, 0.5, 1, 2, 2.9, 2.999, 3.0, 3.001, 3.1, 5, 10, 20, 35, 50]) {
      const wronskian = besselJ1(x) * besselY0(x) - besselJ0(x) * besselY1(x);
      const exact = 2 / (Math.PI * x);
      expect(Math.abs(wronskian - exact) / exact, `x=${x}`).toBeLessThan(1e-6);
    }
  });
});

describe('branch-switch continuity at x = 3', () => {
  it('values from the two approximation branches agree', () => {
    const eps = 1e-9;
    for (const fn of [besselJ0, besselJ1, besselY0, besselY1]) {
      expect(Math.abs(fn(3 - eps) - fn(3 + eps))).toBeLessThan(1e-7);
    }
  });
});

describe('Hankel H0^(1) asymptotics and convention pin', () => {
  it('approaches sqrt(2/(pi x)) e^{i(x - pi/4)} with decreasing error', () => {
    const relError = (x: number): number => {
      const h = hankel1_0(x);
      const mag = Math.sqrt(2 / (Math.PI * x));
      const asym = { re: mag * Math.cos(x - Math.PI / 4), im: mag * Math.sin(x - Math.PI / 4) };
      return Math.hypot(h.re - asym.re, h.im - asym.im) / cabs(h);
    };
    expect(relError(25)).toBeLessThan(0.01);
    expect(relError(50)).toBeLessThan(relError(25));
  });

  it('outgoing under e^{-i omega t}: phase of H0^(1)(x) increases with x', () => {
    // Unwrapped phase must grow ~linearly at large argument.
    let prev = carg(hankel1_0(5));
    let unwrapped = prev;
    for (let x = 5.1; x < 15; x += 0.1) {
      let phase = carg(hankel1_0(x));
      while (phase < prev - Math.PI) phase += 2 * Math.PI;
      expect(phase).toBeGreaterThan(prev);
      unwrapped += phase - prev;
      prev = phase;
    }
    expect(unwrapped - carg(hankel1_0(5))).toBeCloseTo(10, 1);
  });
});
