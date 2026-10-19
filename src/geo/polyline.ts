/**
 * polyline.ts — measuring and walking along a line on the Earth.
 *
 * Imagine a piece of string laid along the route. To answer "where are Joel and
 * Ellie after 1 234 km?" we:
 *   1. measure every little piece of string once (cumulative distances), then
 *   2. find which piece contains 1 234 km (binary search — very fast), and
 *   3. slide the right fraction along that piece (linear interpolation).
 *
 * Everything here is plain math with no browser or library dependency, so it is
 * covered by unit tests (polyline.test.ts).
 */
import type { LngLat } from '../data/types';

/** Mean Earth radius in metres (the value used by most web maps). */
const EARTH_RADIUS_M = 6_371_008.8;
const DEG = Math.PI / 180;

/** Great-circle distance between two points, in metres (the "haversine" formula). */
export function haversineMeters(a: LngLat, b: LngLat): number {
  const dLat = (b[1] - a[1]) * DEG;
  const dLng = (b[0] - a[0]) * DEG;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * DEG) * Math.cos(b[1] * DEG) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Compass bearing from a to b in degrees (0 = north, 90 = east), using a flat
 * approximation that is accurate for the short distances we sample over.
 */
export function bearingDegrees(a: LngLat, b: LngLat): number {
  const dx = (b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * DEG);
  const dy = b[1] - a[1];
  const deg = Math.atan2(dx, dy) / DEG;
  return (deg + 360) % 360;
}

/** A reusable, mutable [lng, lat] output so hot loops do not allocate arrays. */
export type MutableLngLat = [number, number];

/**
 * A measured polyline. Build it once (O(n)); afterwards every lookup is O(log n).
 */
export class Polyline {
  /** Flat coordinate storage: [lng0, lat0, lng1, lat1, …] (compact and cache-friendly). */
  readonly coords: Float64Array;
  /** cumulative[i] = distance in metres from the first point to point i. */
  readonly cumulative: Float64Array;
  /** Total length in metres. */
  readonly length: number;
  /** Number of points. */
  readonly count: number;

  constructor(points: readonly LngLat[]) {
    if (points.length === 0) throw new Error('Polyline needs at least one point');
    this.count = points.length;
    this.coords = new Float64Array(points.length * 2);
    this.cumulative = new Float64Array(points.length);
    let total = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      this.coords[i * 2] = p[0];
      this.coords[i * 2 + 1] = p[1];
      if (i > 0) total += haversineMeters(points[i - 1]!, p);
      this.cumulative[i] = total;
    }
    this.length = total;
  }

  /**
   * Finds the index i such that cumulative[i] <= distance < cumulative[i + 1].
   * Classic binary search: halve the search range until one segment is left.
   */
  segmentIndexAt(distance: number): number {
    const cum = this.cumulative;
    if (distance <= 0) return 0;
    if (distance >= this.length) return Math.max(0, this.count - 2);
    let lo = 0;
    let hi = this.count - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid]! <= distance) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  /**
   * Writes the point `distance` metres along the line into `out` and returns it.
   * Distances outside [0, length] are clamped to the ends.
   */
  pointAt(distance: number, out: MutableLngLat = [0, 0]): MutableLngLat {
    if (this.count === 1) {
      out[0] = this.coords[0]!;
      out[1] = this.coords[1]!;
      return out;
    }
    const d = Math.min(Math.max(distance, 0), this.length);
    const i = this.segmentIndexAt(d);
    const segStart = this.cumulative[i]!;
    const segLen = this.cumulative[i + 1]! - segStart;
    const t = segLen > 0 ? (d - segStart) / segLen : 0;
    out[0] = this.coords[i * 2]! + (this.coords[i * 2 + 2]! - this.coords[i * 2]!) * t;
    out[1] = this.coords[i * 2 + 1]! + (this.coords[i * 2 + 3]! - this.coords[i * 2 + 1]!) * t;
    return out;
  }

  /**
   * Smoothed travel direction at `distance`, in compass degrees. Instead of the
   * direction of one tiny segment (which jitters on detailed roads), we look
   * `window` metres behind and ahead and take the direction between them. This
   * makes the characters turn gracefully at bends.
   */
  bearingAt(distance: number, window = 1500): number {
    const a = this.pointAt(distance - window, scratchA);
    const b = this.pointAt(distance + window, scratchB);
    if (a[0] === b[0] && a[1] === b[1]) return 0;
    return bearingDegrees(a, b);
  }
}

// Scratch arrays reused by bearingAt so it never allocates.
const scratchA: MutableLngLat = [0, 0];
const scratchB: MutableLngLat = [0, 0];

/**
 * Builds a gently curved arc between two points (used to draw the time-skip
 * "jump" so it reads as a leap, not a road). Returns `segments + 1` points.
 */
export function arcBetween(a: LngLat, b: LngLat, segments = 64, bulge = 0.18): LngLat[] {
  const points: LngLat[] = [];
  // Perpendicular direction (rotate the a→b vector by 90°) to push the middle sideways/up.
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const nx = -dy;
  const ny = dx;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const lift = Math.sin(Math.PI * t) * bulge; // 0 at both ends, max in the middle
    points.push([a[0] + dx * t + nx * lift, a[1] + dy * t + ny * lift]);
  }
  return points;
}
