import { describe, expect, it } from 'vitest';
import {
  cabs,
  C_0,
  defaultLayeredSlabState,
  derivePlanarInterface,
  deriveLayeredSlab,
  layeredSlabModel,
  slabFieldsAt,
  slabIncidentFieldsAt,
  timeAveragedPoynting,
  type LayeredSlabState,
} from '@openem/physics-core';

const base = defaultLayeredSlabState; // 1 GHz, TE, eps 4 | 1 | 4, 60 deg, d = 0.3 lambda1

const derive = (over: Partial<LayeredSlabState>) => deriveLayeredSlab({ ...base, ...over });

/**
 * Reference values from the transfer-matrix solver in RF-and-Antenna-Tutorials
 * (Multilayer_Media_Transfer_Matrix_Method_Tutorial.ipynb), evaluated at 1 GHz
 * with the CODATA constants used here. That solver multiplies 2x2 interface and
 * propagation matrices; this model uses the closed-form Airy sum, so agreement
 * checks the algebra of both.
 */
const NOTEBOOK_REFERENCE: {
  id: string;
  state: Partial<LayeredSlabState>;
  rRe: number;
  rIm: number;
  R: number;
  T: number;
}[] = [
  {
    id: 'frustrated TIR, TE',
    state: {
      polarization: 'TE',
      thetaDeg: 60,
      eps1R: 4,
      eps2R: 1,
      eps3R: 4,
      thicknessLambda1: 0.3,
    },
    rRe: -0.25927565704434924,
    rIm: -0.8429727782065506,
    R: 0.7778269711330493,
    T: 0.22217302886695056,
  },
  {
    id: 'frustrated TIR, TM',
    state: {
      polarization: 'TM',
      thetaDeg: 60,
      eps1R: 4,
      eps2R: 1,
      eps3R: 4,
      thicknessLambda1: 0.3,
    },
    rRe: -0.9052046764128636,
    rIm: -0.3797492224049999,
    R: 0.9636049781169191,
    T: 0.03639502188308028,
  },
  {
    id: 'Fabry-Perot, TE',
    state: {
      polarization: 'TE',
      thetaDeg: 60,
      eps1R: 4,
      eps2R: 8,
      eps3R: 4,
      thicknessLambda1: 0.45,
    },
    rRe: -0.00045956905325358465,
    rIm: 0.01749766170438009,
    R: 0.000306379368835638,
    T: 0.9996936206311643,
  },
  {
    id: 'asymmetric stack, TM',
    state: {
      polarization: 'TM',
      thetaDeg: 30,
      eps1R: 1,
      eps2R: 2.25,
      eps3R: 1.5,
      thicknessLambda1: 0.7,
    },
    rRe: 0.07558245968296298,
    rIm: 0.010725223609270402,
    R: 0.005827738633195575,
    T: 0.9941722613668047,
  },
  {
    id: 'TIR at the exit face, TE',
    state: {
      polarization: 'TE',
      thetaDeg: 70,
      eps1R: 2,
      eps2R: 6,
      eps3R: 1.2,
      thicknessLambda1: 0.37,
    },
    rRe: 0.640414446561413,
    rIm: -0.768029515471533,
    R: 1,
    T: 0,
  },
  {
    id: 'normal incidence, TM',
    state: {
      polarization: 'TM',
      thetaDeg: 0,
      eps1R: 1,
      eps2R: 12,
      eps3R: 1,
      thicknessLambda1: 1.3,
    },
    rRe: 0.001304209969816898,
    rIm: -0.03319429647555975,
    R: 0.001103562282152728,
    T: 0.998896437717847,
  },
];

describe('agreement with the notebook transfer-matrix solver', () => {
  for (const ref of NOTEBOOK_REFERENCE) {
    it(ref.id, () => {
      const d = derive(ref.state);
      expect(d.r.re).toBeCloseTo(ref.rRe, 10);
      expect(d.r.im).toBeCloseTo(ref.rIm, 10);
      expect(d.R).toBeCloseTo(ref.R, 10);
      expect(d.T).toBeCloseTo(ref.T, 10);
    });
  }
});

describe('limits and closed forms', () => {
  it('d = 0 matches the planar-interface model for media 1 -> 3 (TE and TM, incl. TIR)', () => {
    for (const polarization of ['TE', 'TM'] as const) {
      for (const [eps1R, eps3R, thetaDeg] of [
        [1, 4, 30],
        [4, 1, 20],
        [4, 1, 50], // beyond the critical angle
        [2.25, 9, 75],
      ] as const) {
        const slab = derive({
          polarization,
          eps1R,
          eps2R: 7,
          eps3R,
          thetaDeg,
          thicknessLambda1: 0,
        });
        const iface = derivePlanarInterface({
          frequencyHz: base.frequencyHz,
          thetaDeg,
          polarization,
          E0: 1,
          eps1R,
          mu1R: 1,
          eps2R: eps3R,
          mu2R: 1,
          sigma2: 0,
          pec: false,
        });
        expect(cabs({ re: slab.r.re - iface.r.re, im: slab.r.im - iface.r.im })).toBeLessThan(
          1e-12,
        );
        expect(slab.T).toBeCloseTo(iface.T, 12);
      }
    }
  });

  it('a slab matched to its surroundings is invisible', () => {
    const d = derive({ eps1R: 2, eps2R: 2, eps3R: 2, thetaDeg: 40, thicknessLambda1: 1.37 });
    expect(d.R).toBeLessThan(1e-28);
    expect(d.T).toBeCloseTo(1, 12);
  });

  it('quarter-wave antireflection coating: n2 = sqrt(n1 n3), d = lambda2/4 gives R = 0', () => {
    const eps1R = 1;
    const eps3R = 2.25;
    const eps2R = Math.sqrt(eps1R * eps3R);
    // lambda2 / lambda1 = n1 / n2
    const thicknessLambda1 = Math.sqrt(eps1R / eps2R) / 4;
    const d = derive({ eps1R, eps2R, eps3R, thetaDeg: 0, thicknessLambda1 });
    expect(d.R).toBeLessThan(1e-28);
  });

  it('symmetric propagating slab: R = 0 at half-wave steps and the peak follows Airy', () => {
    const over = { eps1R: 4, eps2R: 8, eps3R: 4, thetaDeg: 60 };
    const d0 = derive(over);
    const step = d0.reflectancePeriodLambda1 as number;
    expect(derive({ ...over, thicknessLambda1: step }).R).toBeLessThan(1e-26);
    expect(derive({ ...over, thicknessLambda1: 2 * step }).R).toBeLessThan(1e-26);
    const peak = derive({ ...over, thicknessLambda1: step / 2 }).R;
    expect(peak).toBeCloseTo(d0.airyMaxReflectance as number, 12);
  });

  it('frustrated TIR: T decays as exp(-2 kappa d) once kappa d >> 1', () => {
    const at = (t: number) => derive({ thicknessLambda1: t });
    const d1 = at(1.2);
    const d2 = at(1.6);
    const kappa = d1.kz2.im;
    const slope = Math.log(d2.T / d1.T) / (d2.thicknessM - d1.thicknessM);
    expect(slope / (-2 * kappa)).toBeCloseTo(1, 4);
  });
});

describe('Virginia Tech ECE 5105 exam problem (omega = 3e11 rad/s, theta = 60 deg, TE)', () => {
  const frequencyHz = 3e11 / (2 * Math.PI);
  const exam = (eps2R: number, dMeters: number) => {
    const lambda1 = (2 * Math.PI) / ((3e11 / C_0) * 2);
    return derive({ frequencyHz, eps2R, thicknessLambda1: dMeters / lambda1 });
  };

  it('Case A (eps2 = eps0): T below 1.3% at 2 mm and below 0.1% at 3 mm, as in the report', () => {
    expect(exam(1, 2e-3).T).toBeGreaterThan(0.012);
    expect(exam(1, 2e-3).T).toBeLessThan(0.013);
    expect(exam(1, 3e-3).T).toBeLessThan(0.001);
  });

  it('Case B (eps2 = 8 eps0): over 0-10 mm, max R = 4/9 and min T = 5/9 from the full solution', () => {
    // r12 = (kz1 - kz2)/(kz1 + kz2) with kz1 = k0, kz2 = k0 sqrt(5) gives R_max = 4/9 exactly.
    expect(exam(8, 1e-3).airyMaxReflectance as number).toBeCloseTo(4 / 9, 12);
    let maxR = 0;
    let minT = 1;
    for (let i = 0; i <= 20000; i++) {
      const d = exam(8, (10e-3 * i) / 20000);
      maxR = Math.max(maxR, d.R);
      minT = Math.min(minT, d.T);
    }
    expect(maxR).toBeCloseTo(4 / 9, 6);
    expect(minT).toBeCloseTo(5 / 9, 6);
  });
});

describe('the slab critical angle (kz2 -> 0)', () => {
  // eps 4 | 1 | 4 at 30 deg puts the slab exactly at its critical angle; the
  // TM case 12 | 9 | 1.7 at 60 deg does the same with TIR at the exit face.
  const critical: Partial<LayeredSlabState>[] = [
    { eps1R: 4, eps2R: 1, eps3R: 4, thetaDeg: 30, thicknessLambda1: 1 },
    { eps1R: 4, eps2R: 1, eps3R: 4, thetaDeg: 30, thicknessLambda1: 0.05 },
    { eps1R: 12, eps2R: 9, eps3R: 1.7, thetaDeg: 60, polarization: 'TM', thicknessLambda1: 0.6 },
    { eps1R: 8.6, eps2R: 4.3, eps3R: 2, thetaDeg: 45, thicknessLambda1: 0 },
  ];

  it('runtime validation passes at and around the critical angle', () => {
    for (const c of critical) {
      for (const dTheta of [-1e-3, -1e-7, 0, 1e-7, 1e-3]) {
        const s = { ...base, ...c, thetaDeg: (c.thetaDeg as number) + dTheta };
        const failed = layeredSlabModel.validate(s).filter((v) => !v.pass);
        expect(failed, JSON.stringify({ s, failed })).toEqual([]);
      }
    }
  });

  it('R(theta) is continuous across the critical angle', () => {
    const at = (thetaDeg: number) =>
      derive({ eps1R: 4, eps2R: 1, eps3R: 4, thicknessLambda1: 1, thetaDeg }).R;
    expect(Math.abs(at(30 - 1e-6) - at(30))).toBeLessThan(1e-5);
    expect(Math.abs(at(30 + 1e-6) - at(30))).toBeLessThan(1e-5);
  });

  it('the near-critical (cos/sinc) and Airy forms agree where both are well conditioned', () => {
    // |kz2| d just below and just above the 0.01 switch: r must not jump.
    const s = { ...base, eps1R: 4, eps2R: 1, eps3R: 4, thicknessLambda1: 0.5 };
    const thetaFor = (kz2d: number) => {
      const d = deriveLayeredSlab(s);
      const kz2 = kz2d / d.thicknessM;
      // kz2^2 = k0^2 - kx^2 (propagating side) -> sin(theta) = sqrt(k0^2 - kz2^2)/k1
      return (Math.asin(Math.sqrt(d.k0 ** 2 - kz2 ** 2) / d.k1) * 180) / Math.PI;
    };
    const below = deriveLayeredSlab({ ...s, thetaDeg: thetaFor(0.0099999) });
    const above = deriveLayeredSlab({ ...s, thetaDeg: thetaFor(0.0100001) });
    expect(below.nearCritical).toBe(true);
    expect(above.nearCritical).toBe(false);
    expect(cabs({ re: below.r.re - above.r.re, im: below.r.im - above.r.im })).toBeLessThan(1e-6);
  });
});

describe('fields and power flow', () => {
  const states: LayeredSlabState[] = [];
  for (const polarization of ['TE', 'TM'] as const) {
    for (const [eps1R, eps2R, eps3R] of [
      [4, 1, 4],
      [4, 8, 4],
      [1, 2.25, 1.5],
      [2, 6, 1.2],
      [9, 1, 2],
    ] as const) {
      for (const thetaDeg of [0, 25, 60, 80]) {
        for (const thicknessLambda1 of [0, 0.13, 0.5, 1.7]) {
          states.push({ ...base, polarization, eps1R, eps2R, eps3R, thetaDeg, thicknessLambda1 });
        }
      }
    }
  }

  it(`runtime validation passes for all ${states.length} sweep states`, () => {
    for (const s of states) {
      const failed = layeredSlabModel.validate(s).filter((v) => !v.pass);
      expect(failed, JSON.stringify({ s, failed })).toEqual([]);
    }
  });

  it('lossless media conserve energy: R + T = 1 everywhere in the sweep', () => {
    for (const s of states) {
      const d = deriveLayeredSlab(s);
      expect(Math.abs(d.R + d.T - 1)).toBeLessThan(1e-12);
    }
  });

  it('Sz is uniform through the slab for an evanescent (tunneling) case', () => {
    const d = deriveLayeredSlab(base);
    expect(d.slabRegime).toBe('evanescent');
    const inc = slabIncidentFieldsAt(base, d, 0, -1e-9);
    const SzInc = timeAveragedPoynting(inc.Ephasor, inc.Hphasor).z;
    for (const frac of [0.05, 0.3, 0.6, 0.95]) {
      const f = slabFieldsAt(base, d, 0.17, frac * d.thicknessM, 0);
      expect(timeAveragedPoynting(f.Ephasor, f.Hphasor).z / SzInc).toBeCloseTo(d.T, 10);
    }
  });

  it('CONVENTION PIN: Im kz >= 0 and the evanescent slab field decays from the entrance face', () => {
    const thick = { ...base, thicknessLambda1: 1.5 };
    const d = deriveLayeredSlab(thick);
    expect(d.kz2.im).toBeGreaterThan(0);
    const near = slabFieldsAt(thick, d, 0, 0.1 * d.thicknessM, 0).Ephasor.y;
    const far = slabFieldsAt(thick, d, 0, 0.9 * d.thicknessM, 0).Ephasor.y;
    expect(cabs(far)).toBeLessThan(cabs(near));
  });
});
