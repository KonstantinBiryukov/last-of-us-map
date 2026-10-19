import { describe, expect, it } from 'vitest';
import { Polyline, arcBetween, bearingDegrees, haversineMeters } from './polyline';

describe('geometry helpers', () => {
  it('haversine: one degree of latitude is ~111 km', () => {
    expect(haversineMeters([0, 0], [0, 1]) / 1000).toBeCloseTo(111.2, 0);
  });

  it('bearing: north is 0°, east is 90°', () => {
    expect(bearingDegrees([0, 0], [0, 1])).toBeCloseTo(0);
    expect(bearingDegrees([0, 0], [1, 0])).toBeCloseTo(90);
    expect(bearingDegrees([0, 0], [-1, 0])).toBeCloseTo(270);
  });

  it('pointAt interpolates and clamps', () => {
    const line = new Polyline([
      [0, 0],
      [0, 1],
      [0, 2],
    ]);
    const half = line.length / 2;
    expect(line.pointAt(half)[1]).toBeCloseTo(1, 5);
    expect(line.pointAt(line.length / 4)[1]).toBeCloseTo(0.5, 5);
    expect(line.pointAt(-100)).toEqual([0, 0]);
    expect(line.pointAt(line.length * 2)).toEqual([0, 2]);
  });

  it('handles duplicate points (zero-length segments) without NaN', () => {
    const line = new Polyline([
      [5, 5],
      [5, 5],
      [6, 5],
    ]);
    const p = line.pointAt(10);
    expect(Number.isFinite(p[0])).toBe(true);
    expect(Number.isFinite(line.bearingAt(0))).toBe(true);
  });

  it('arcBetween starts and ends exactly at the given points', () => {
    const arc = arcBetween([-97, 30], [-71, 42], 10);
    expect(arc).toHaveLength(11);
    expect(arc[0]).toEqual([-97, 30]);
    expect(arc[10]![0]).toBeCloseTo(-71);
    expect(arc[10]![1]).toBeCloseTo(42);
  });
});
