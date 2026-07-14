import { describe, expect, it } from 'vitest';
import { C_0, EPSILON_0, ETA_0, MU_0 } from '@openem/physics-core';

describe('physical constants', () => {
  it('eta_0 is about 376.730 ohms', () => {
    expect(ETA_0).toBeCloseTo(376.7303, 3);
  });

  it('1/sqrt(mu_0 eps_0) reproduces c', () => {
    expect(1 / Math.sqrt(MU_0 * EPSILON_0)).toBeCloseTo(C_0, -1);
  });
});
