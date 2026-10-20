/**
 * keyPointGeometry.ts — the measuring helpers behind the key-point placement (keyPoints.ts):
 * distances on the map, which parts of the route are actually travelled, where the route
 * passes closest to a place, and when the travellers are there. Moved out of keyPoints.ts
 * unchanged, to keep that file about the placement rules themselves. Pure functions.
 */
import type { LngLat } from '../data/types';
import type { Route } from '../geo/route';
import { isJumpKind, type LegSpan, type Timeline } from './timeline';

/** Metres per degree of latitude (and of longitude at the equator), and degrees → radians. */
export const METRES_PER_DEGREE = 111_320;
export const DEG = Math.PI / 180;
/** Two candidate spots within this many metres of the same distance count as a tie. */
const TIE_METRES = 30;


/** A short straight piece of the travelled route, in degrees ([lng, lat] → [lng, lat]). */
export type Segment = readonly [number, number, number, number];

/** Every piece of the route that is actually travelled (jump arcs are just drawn, not walked). */
export function travelledSegments(route: Route): Segment[] {
  const out: Segment[] = [];
  route.legs.forEach((leg) => {
    if (isJumpKind(leg.kind)) return;
    const c = leg.coordinates;
    for (let k = 1; k < c.length; k++) out.push([c[k - 1]![0], c[k - 1]![1], c[k]![0], c[k]![1]]);
  });
  return out;
}

/** Distance in metres from point (lng, lat) to a segment, on a flat patch around the point. */
export function distanceToSegment(lng: number, lat: number, s: Segment): number {
  const kx = METRES_PER_DEGREE * Math.cos(lat * DEG);
  const ax = (s[0] - lng) * kx;
  const ay = (s[1] - lat) * METRES_PER_DEGREE;
  const bx = (s[2] - lng) * kx;
  const by = (s[3] - lat) * METRES_PER_DEGREE;
  // Closest point of segment a→b to the origin: a + t·(b − a), t clamped to 0‥1.
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq > 0 ? Math.min(1, Math.max(0, -(ax * dx + ay * dy) / lengthSq)) : 0;
  return Math.hypot(ax + dx * t, ay + dy * t);
}

/** Distance in metres between two points (flat patch; fine at these scales). */
export function flatDistance(aLng: number, aLat: number, bLng: number, bLat: number): number {
  const kx = METRES_PER_DEGREE * Math.cos(((aLat + bLat) / 2) * DEG);
  return Math.hypot((bLng - aLng) * kx, (bLat - aLat) * METRES_PER_DEGREE);
}

/** The chapter's travelled (non-jump) parts. */
export function travelledSpans(timeline: Timeline, chapterIndex: number): readonly LegSpan[] {
  return timeline.chapters[chapterIndex]!.legSpans.filter((s) => !isJumpKind(s.kind));
}

/**
 * The point of these route parts closest to `coord`, after journey distance `after`: its
 * distance along the journey. On a tie (within TIE_METRES) the earliest point wins.
 */
export function closestDistance(route: Route, spans: readonly LegSpan[], coord: LngLat, after: number): number {
  // Pass 1: sample the route every ~25 m and remember how far each sample is from the place.
  const point: [number, number] = [0, 0];
  const samples: { d: number; metres: number }[] = [];
  for (const span of spans) {
    const length = span.endDistance - span.startDistance;
    const steps = Math.min(4000, Math.max(20, Math.ceil(length / 25))); // every ~25 m (≤ 4000 samples)
    for (let i = 0; i <= steps; i++) {
      const d = span.startDistance + (length * i) / steps;
      if (d <= after) continue;
      route.journey.pointAt(d, point);
      samples.push({ d, metres: flatDistance(point[0], point[1], coord[0], coord[1]) });
    }
  }
  if (samples.length === 0) return spans.at(-1)!.endDistance;
  // Pass 2: the closest distance, then the EARLIEST sample that is (nearly) as close.
  const closest = Math.min(...samples.map((s) => s.metres));
  return samples.find((s) => s.metres <= closest + TIE_METRES)!.d;
}

/** The span (of these) containing journey distance d, if any. */
export function spanAt(spans: readonly LegSpan[], d: number): LegSpan | undefined {
  return spans.find((s) => d >= s.startDistance && d <= s.endDistance);
}

/** When the travellers are at distance d (inside `span`), as a fraction of the chapter's time. */
export function timeFraction(timeline: Timeline, chapterIndex: number, span: LegSpan, d: number): number {
  const chapter = timeline.chapters[chapterIndex]!;
  const along = span.endDistance > span.startDistance ? (d - span.startDistance) / (span.endDistance - span.startDistance) : 0;
  const time = span.start + (span.end - span.start) * along;
  return (time - chapter.start) / (chapter.end - chapter.start);
}
