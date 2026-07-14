import type { Complex } from './complex';

/**
 * Bessel functions of the first and second kind, orders 0 and 1, real
 * positive argument, via the Abramowitz & Stegun 9.4.1-9.4.6 polynomial
 * approximations (public-domain coefficients). Certified absolute error
 * bounds: < 5e-8 (J0), 1.4e-8 (Y0), 1.3e-8 (J1/x), 1.1e-7 (x*Y1) for x <= 3;
 * < 1.6e-7 in modulus/phase form for x > 3. Y0/Y1 require x > 0.
 */

const TWO_OVER_PI = 2 / Math.PI;

export function besselJ0(x: number): number {
  const ax = Math.abs(x);
  if (ax <= 3) {
    const t = (ax / 3) ** 2;
    // A&S 9.4.1
    return (
      1 +
      t *
        (-2.2499997 +
          t * (1.2656208 + t * (-0.3163866 + t * (0.0444479 + t * (-0.0039444 + t * 0.00021)))))
    );
  }
  const t = 3 / ax;
  // A&S 9.4.3
  const f0 =
    0.79788456 +
    t *
      (-0.00000077 +
        t *
          (-0.0055274 + t * (-0.00009512 + t * (0.00137237 + t * (-0.00072805 + t * 0.00014476)))));
  const theta0 =
    ax -
    0.78539816 +
    t *
      (-0.04166397 +
        t *
          (-0.00003954 +
            t * (0.00262573 + t * (-0.00054125 + t * (-0.00029333 + t * 0.00013558)))));
  return (f0 * Math.cos(theta0)) / Math.sqrt(ax);
}

export function besselY0(x: number): number {
  if (x <= 0) return NaN;
  if (x <= 3) {
    const t = (x / 3) ** 2;
    // A&S 9.4.2
    const p =
      0.36746691 +
      t *
        (0.60559366 +
          t *
            (-0.74350384 +
              t * (0.25300117 + t * (-0.04261214 + t * (0.00427916 - t * 0.00024846)))));
    return TWO_OVER_PI * Math.log(x / 2) * besselJ0(x) + p;
  }
  const t = 3 / x;
  const f0 =
    0.79788456 +
    t *
      (-0.00000077 +
        t *
          (-0.0055274 + t * (-0.00009512 + t * (0.00137237 + t * (-0.00072805 + t * 0.00014476)))));
  const theta0 =
    x -
    0.78539816 +
    t *
      (-0.04166397 +
        t *
          (-0.00003954 +
            t * (0.00262573 + t * (-0.00054125 + t * (-0.00029333 + t * 0.00013558)))));
  return (f0 * Math.sin(theta0)) / Math.sqrt(x);
}

export function besselJ1(x: number): number {
  const ax = Math.abs(x);
  if (ax <= 3) {
    const t = (ax / 3) ** 2;
    // A&S 9.4.4 gives J1(x)/x
    const j1OverX =
      0.5 +
      t *
        (-0.56249985 +
          t *
            (0.21093573 +
              t * (-0.03954289 + t * (0.00443319 + t * (-0.00031761 + t * 0.00001109)))));
    return x * j1OverX;
  }
  const t = 3 / ax;
  // A&S 9.4.6
  const f1 =
    0.79788456 +
    t *
      (0.00000156 +
        t *
          (0.01659667 + t * (0.00017105 + t * (-0.00249511 + t * (0.00113653 - t * 0.00020033)))));
  const theta1 =
    ax -
    2.35619449 +
    t *
      (0.12499612 +
        t * (0.0000565 + t * (-0.00637879 + t * (0.00074348 + t * (0.00079824 - t * 0.00029166)))));
  const value = (f1 * Math.cos(theta1)) / Math.sqrt(ax);
  return x < 0 ? -value : value;
}

export function besselY1(x: number): number {
  if (x <= 0) return NaN;
  if (x <= 3) {
    const t = (x / 3) ** 2;
    // A&S 9.4.5 gives x*Y1(x) minus the log term
    const p =
      -0.6366198 +
      t *
        (0.2212091 +
          t * (2.1682709 + t * (-1.3164827 + t * (0.3123951 + t * (-0.0400976 + t * 0.0027873)))));
    return TWO_OVER_PI * Math.log(x / 2) * besselJ1(x) + p / x;
  }
  const t = 3 / x;
  const f1 =
    0.79788456 +
    t *
      (0.00000156 +
        t *
          (0.01659667 + t * (0.00017105 + t * (-0.00249511 + t * (0.00113653 - t * 0.00020033)))));
  const theta1 =
    x -
    2.35619449 +
    t *
      (0.12499612 +
        t * (0.0000565 + t * (-0.00637879 + t * (0.00074348 + t * (0.00079824 - t * 0.00029166)))));
  return (f1 * Math.sin(theta1)) / Math.sqrt(x);
}

/**
 * Hankel function of the first kind, order 0: H0^(1) = J0 + iY0.
 * Under e^{-i omega t} this is the OUTGOING cylindrical wave
 * (docs/physics-conventions.md); H0^(2) would be incoming.
 */
export const hankel1_0 = (x: number): Complex => ({ re: besselJ0(x), im: besselY0(x) });

/** Hankel function of the first kind, order 1. Note d/dx H0^(1)(x) = -H1^(1)(x). */
export const hankel1_1 = (x: number): Complex => ({ re: besselJ1(x), im: besselY1(x) });
