import { describe, expect, it } from 'vitest';
import {
  cabs,
  carg,
  cnormSq,
  defaultPlanarInterfaceState,
  derivePlanarInterface,
  incidentFieldsAt,
  interfaceFieldsAt,
  planarInterfaceModel,
  timeAveragedPoynting,
  ETA_0,
  type PlanarInterfaceState,
} from '@openem/physics-core';

const base = defaultPlanarInterfaceState; // 1 GHz, TE, eps 1 -> 4, theta 30 deg

const derive = (over: Partial<PlanarInterfaceState>) => derivePlanarInterface({ ...base, ...over });

describe('normal incidence closed forms (eta form, conjugated from e^{+jwt} texts)', () => {
  it('r_TE = (eta2 - eta1)/(eta2 + eta1) at theta = 0', () => {
    const d = derive({ thetaDeg: 0, eps2R: 4 });
    // eta2 = eta0/2, eta1 = eta0 -> r = (1/2-1)/(1/2+1) = -1/3
    expect(d.r.re).toBeCloseTo(-1 / 3, 12);
    expect(d.r.im).toBeCloseTo(0, 12);
    expect(d.R).toBeCloseTo(1 / 9, 12);
    expect(d.T).toBeCloseTo(8 / 9, 12);
  });

  it('SIGN PIN: r_TM as E-ratio equals r_TE at normal incidence (Hy ratio is its negative)', () => {
    const dTE = derive({ thetaDeg: 0 });
    const dTM = derive({ thetaDeg: 0, polarization: 'TM' });
    // TM E-field reflection coefficient = -(Hy ratio)
    expect(-dTM.r.re).toBeCloseTo(dTE.r.re, 12);
  });

  it('eps2 -> eps1 limit gives r = 0, t = 1', () => {
    for (const pol of ['TE', 'TM'] as const) {
      const d = derive({ eps2R: 1, polarization: pol, thetaDeg: 40 });
      expect(cabs(d.r)).toBeLessThan(1e-12);
      expect(d.t.re).toBeCloseTo(1, 12);
    }
  });
});

describe('Snell and Brewster', () => {
  it('kx is conserved and matches sin(theta2) = kx/k2 for real media', () => {
    const d = derive({ thetaDeg: 50 });
    const k2 = Math.sqrt(4) * d.k1; // n2 = 2
    const sinTheta2 = d.kx / k2;
    expect(sinTheta2).toBeCloseTo(Math.sin((50 * Math.PI) / 180) / 2, 12);
    // kz2 consistent: kz2^2 + kx^2 = k2^2
    expect(d.kz2.re ** 2 - d.kz2.im ** 2 + d.kx ** 2).toBeCloseTo(k2 * k2, 0);
  });

  it('TM reflection vanishes at Brewster; TE does not', () => {
    const thetaB = (Math.atan(2) * 180) / Math.PI; // eps 1 -> 4: atan(n2/n1)
    const dTM = derive({ polarization: 'TM', thetaDeg: thetaB });
    expect(dTM.thetaBrewsterDeg).toBeCloseTo(thetaB, 10);
    expect(cabs(dTM.r)).toBeLessThan(1e-12);
    const dTE = derive({ polarization: 'TE', thetaDeg: thetaB });
    expect(cabs(dTE.r)).toBeGreaterThan(0.1);
  });
});

describe('total internal reflection (dense to rare, eps 4 -> 1)', () => {
  const tir: Partial<PlanarInterfaceState> = { eps1R: 4, eps2R: 1 };

  it('critical angle is 30 deg; |r| = 1 beyond it for both polarizations', () => {
    const d = derive({ ...tir, thetaDeg: 20 });
    expect(d.thetaCriticalDeg).toBeCloseTo(30, 10);
    expect(d.regime).toBe('propagating');
    for (const pol of ['TE', 'TM'] as const) {
      const dd = derive({ ...tir, thetaDeg: 45, polarization: pol });
      expect(dd.regime).toBe('evanescent');
      expect(cabs(dd.r)).toBeCloseTo(1, 12);
      expect(dd.T).toBeCloseTo(0, 12);
    }
  });

  it('evanescent decay rate in medium 2 equals Im(kz2)', () => {
    const state = { ...base, ...tir, thetaDeg: 45 };
    const d = derivePlanarInterface(state);
    expect(d.kz2.im).toBeGreaterThan(0);
    expect(Math.abs(d.kz2.re)).toBeLessThan(1e-6 * d.k1);
    const z1 = 0.05 * d.wavelength1M;
    const z2 = 0.35 * d.wavelength1M;
    const f1 = interfaceFieldsAt(state, d, 0.1, z1, 0);
    const f2 = interfaceFieldsAt(state, d, 0.1, z2, 0);
    const ratio = Math.sqrt(cnormSq(f2.Ephasor) / cnormSq(f1.Ephasor));
    expect(ratio).toBeCloseTo(Math.exp(-d.kz2.im * (z2 - z1)), 10);
  });

  it('under TIR power in medium 2 flows along the interface, not across it', () => {
    const state = { ...base, ...tir, thetaDeg: 45 };
    const d = derivePlanarInterface(state);
    const f = interfaceFieldsAt(state, d, 0, 0.1 * d.wavelength1M, 0);
    const S = timeAveragedPoynting(f.Ephasor, f.Hphasor);
    expect(Math.abs(S.z)).toBeLessThan(1e-12 * Math.abs(S.x));
    expect(S.x).toBeGreaterThan(0);
  });
});

describe('power balance computed from the fields', () => {
  const cases: [string, Partial<PlanarInterfaceState>][] = [
    ['TE lossless oblique', { thetaDeg: 35 }],
    ['TM lossless oblique', { polarization: 'TM', thetaDeg: 55 }],
    ['TE lossy medium 2', { sigma2: 0.05, thetaDeg: 30 }],
    ['TM lossy medium 2', { polarization: 'TM', sigma2: 0.2, thetaDeg: 60 }],
    ['near grazing', { thetaDeg: 89 }],
  ];
  for (const [name, over] of cases) {
    it(`R + Sz(0+)/Sz_inc = 1 (${name})`, () => {
      const state = { ...base, ...over };
      const d = derivePlanarInterface(state);
      const inc = incidentFieldsAt(state, d, 0, -1e-9);
      const SzInc = timeAveragedPoynting(inc.Ephasor, inc.Hphasor).z;
      const f = interfaceFieldsAt(state, d, 0, 1e-30, 0);
      const SzTrans = timeAveragedPoynting(f.Ephasor, f.Hphasor).z;
      expect(d.R + SzTrans / SzInc).toBeCloseTo(1, 9);
      expect(SzTrans / SzInc).toBeCloseTo(d.T, 9);
    });
  }

  it('lossy medium 2 has |r| < 1', () => {
    const d = derive({ sigma2: 0.1 });
    expect(cabs(d.r)).toBeLessThan(1);
    expect(d.regime).toBe('lossy');
  });
});

describe('tangential continuity across the interface (field-level)', () => {
  const thetas = [0, 20, 63.4349, 45, 89];
  for (const pol of ['TE', 'TM'] as const) {
    it(`${pol}: tangential E and H match at z = 0- and 0+ across a theta sweep`, () => {
      for (const thetaDeg of thetas) {
        const state = { ...base, polarization: pol, thetaDeg };
        const d = derivePlanarInterface(state);
        const below = interfaceFieldsAt(state, d, 0.02, -1e-12, 0);
        const above = interfaceFieldsAt(state, d, 0.02, 1e-12, 0);
        // Tangential components: Ex, Ey, Hx, Hy.
        for (const [name, a, b] of [
          ['Ex', below.Ephasor.x, above.Ephasor.x],
          ['Ey', below.Ephasor.y, above.Ephasor.y],
          ['Hx', below.Hphasor.x, above.Hphasor.x],
          ['Hy', below.Hphasor.y, above.Hphasor.y],
        ] as const) {
          const scale = Math.max(cabs(a), cabs(b), 1e-9);
          expect(
            Math.hypot(a.re - b.re, a.im - b.im) / scale,
            `${name} at ${thetaDeg} deg`,
          ).toBeLessThan(1e-6);
        }
      }
    });
  }
});

describe('PEC wall', () => {
  it('r_TE = -1: total field vanishes at the wall, standing-wave nulls every lambda/2', () => {
    const state: PlanarInterfaceState = { ...base, pec: true, thetaDeg: 0 };
    const d = derivePlanarInterface(state);
    expect(d.r.re).toBe(-1);
    expect(d.R).toBeCloseTo(1, 12);
    const atWall = interfaceFieldsAt(state, d, 0, -1e-15, 0);
    expect(cabs(atWall.Ephasor.y)).toBeLessThan(1e-9);
    // Nulls of the standing wave at z = -m lambda/2.
    const halfLambda = d.wavelength1M / 2;
    const atNull = interfaceFieldsAt(state, d, 0, -halfLambda, 0);
    const atAntinode = interfaceFieldsAt(state, d, 0, -halfLambda / 2, 0);
    expect(cabs(atNull.Ephasor.y)).toBeLessThan(1e-6 * cabs(atAntinode.Ephasor.y));
    // Medium 2 is field-free.
    const inside = interfaceFieldsAt(state, d, 0, 0.01, 0);
    expect(cnormSq(inside.Ephasor)).toBe(0);
  });

  it('TM Hy ratio is +1 at a PEC wall', () => {
    const d = derive({ pec: true, polarization: 'TM' });
    expect(d.r.re).toBe(1);
  });
});

describe('convention pins (docs/physics-conventions.md)', () => {
  it('Im(kz2) >= 0 across regimes; transmitted field never grows with z', () => {
    for (const over of [
      {},
      { sigma2: 1 },
      { eps1R: 4, eps2R: 1, thetaDeg: 60 },
    ] as Partial<PlanarInterfaceState>[]) {
      const d = derive(over);
      expect(d.kz2.im).toBeGreaterThanOrEqual(0);
    }
  });

  it('TM phase relationship: Hy phasor at origin equals E0/eta1 times (1 + r)', () => {
    const state: PlanarInterfaceState = { ...base, polarization: 'TM', thetaDeg: 40 };
    const d = derivePlanarInterface(state);
    const f = interfaceFieldsAt(state, d, 0, -1e-15, 0);
    const expected = (state.E0 / ETA_0) * cabs(d.t);
    expect(cabs(f.Hphasor.y)).toBeCloseTo(expected, 8);
    expect(carg(f.Hphasor.y)).toBeCloseTo(carg(d.t), 8);
  });
});

describe('model contract', () => {
  it('validate() passes across representative states', () => {
    const states: Partial<PlanarInterfaceState>[] = [
      {},
      { polarization: 'TM', thetaDeg: 63.4349 },
      { eps1R: 4, eps2R: 1, thetaDeg: 45 },
      { sigma2: 0.3 },
      { pec: true },
      { pec: true, polarization: 'TM' },
    ];
    for (const over of states) {
      const state = { ...base, ...over };
      for (const result of planarInterfaceModel.validate(state)) {
        expect(result.pass, `${JSON.stringify(over)} ${result.id}: ${result.residual}`).toBe(true);
      }
    }
  });

  it('sampleField matches interfaceFieldsAt on both sides', () => {
    const state = { ...base, thetaDeg: 40 };
    const d = derivePlanarInterface(state);
    const z = 0.13 * d.wavelength1M;
    const points = new Float32Array([0.05, 0, -z, 0.05, 0, z]);
    const sample = planarInterfaceModel.sampleField(state, points, 0.2e-9);
    const below = interfaceFieldsAt(state, d, 0.05, -z, 0.2e-9);
    const above = interfaceFieldsAt(state, d, 0.05, z, 0.2e-9);
    expect(sample.E[1]).toBeCloseTo(below.E.y, 6);
    expect(sample.E[4]).toBeCloseTo(above.E.y, 6);
    expect(sample.Ephasor[8]).toBeCloseTo(above.Ephasor.y.re, 6);
  });
});
