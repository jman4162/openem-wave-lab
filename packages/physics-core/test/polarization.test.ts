import { describe, expect, it } from 'vitest';
import { classifyPolarization } from '@openem/physics-core';

describe('polarization classification', () => {
  it('single component is linear along its axis', () => {
    const px = classifyPolarization(1, 0, 0);
    expect(px.type).toBe('linear');
    expect(px.tiltDeg).toBeCloseTo(0, 10);
    const py = classifyPolarization(0, 1, 0);
    expect(py.type).toBe('linear');
    expect(Math.abs(py.tiltDeg)).toBeCloseTo(90, 10);
  });

  it('equal amplitudes, delta = 0, gives linear at 45 degrees', () => {
    const p = classifyPolarization(1, 1, 0);
    expect(p.type).toBe('linear');
    expect(p.handedness).toBeNull();
    expect(p.axialRatio).toBe(Infinity);
    expect(p.tiltDeg).toBeCloseTo(45, 10);
  });

  it('delta = 180 deg gives linear at -45 degrees', () => {
    const p = classifyPolarization(1, 1, 180);
    expect(p.type).toBe('linear');
    expect(p.tiltDeg).toBeCloseTo(-45, 8);
  });

  it('equal amplitudes, delta = +/-90 deg, gives circular with IEEE handedness', () => {
    const rh = classifyPolarization(1, 1, 90);
    expect(rh.type).toBe('circular');
    expect(rh.handedness).toBe('RH');
    expect(rh.axialRatio).toBe(1);
    const lh = classifyPolarization(1, 1, -90);
    expect(lh.handedness).toBe('LH');
  });

  it('unequal amplitudes at delta = 90 deg give an axis-aligned ellipse', () => {
    const p = classifyPolarization(1, 0.5, 90);
    expect(p.type).toBe('elliptical');
    expect(p.handedness).toBe('RH');
    expect(p.axialRatio).toBeCloseTo(2, 10);
    expect(p.tiltDeg).toBeCloseTo(0, 10);
  });

  it('intermediate delta gives a tilted ellipse', () => {
    const p = classifyPolarization(1, 1, 45);
    expect(p.type).toBe('elliptical');
    expect(p.handedness).toBe('RH');
    expect(p.tiltDeg).toBeCloseTo(45, 10);
    expect(p.axialRatio).toBeGreaterThan(1);
    expect(Number.isFinite(p.axialRatio)).toBe(true);
  });

  it('zero field degenerates to linear', () => {
    const p = classifyPolarization(0, 0, 0);
    expect(p.type).toBe('linear');
    expect(p.axialRatio).toBe(Infinity);
  });
});
