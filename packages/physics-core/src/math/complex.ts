export interface Complex {
  re: number;
  im: number;
}

export const complex = (re: number, im = 0): Complex => ({ re, im });

export const cadd = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });

export const csub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });

export const cmul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});

export const cdiv = (a: Complex, b: Complex): Complex => {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};

export const cscale = (a: Complex, s: number): Complex => ({ re: a.re * s, im: a.im * s });

export const conj = (a: Complex): Complex => ({ re: a.re, im: -a.im });

export const cabs = (a: Complex): number => Math.hypot(a.re, a.im);

export const carg = (a: Complex): number => Math.atan2(a.im, a.re);

/** e^{a} for complex a. */
export const cexp = (a: Complex): Complex => {
  const r = Math.exp(a.re);
  return { re: r * Math.cos(a.im), im: r * Math.sin(a.im) };
};

/** e^{i phi} for real phi. */
export const expi = (phi: number): Complex => ({ re: Math.cos(phi), im: Math.sin(phi) });

/**
 * Principal-branch square root: arg(result) in (-pi/2, pi/2], so Re >= 0.
 * For passive media under e^{-i omega t} (Im eps_c >= 0) this branch yields
 * k = beta + i alpha with beta > 0, alpha >= 0 and Re eta > 0.
 */
export const csqrt = (a: Complex): Complex => {
  const r = cabs(a);
  const phi = carg(a) / 2;
  const s = Math.sqrt(r);
  return { re: s * Math.cos(phi), im: s * Math.sin(phi) };
};
