/**
 * route.ts — loads the original route file, corrects it, and measures it.
 *
 * Result: a `Route` with
 *   • `legs`     – the 17 legs, each with its metadata (kind, travel mode) and
 *                  its CORRECTED coordinates;
 *   • `legLines` – one measured Polyline per leg (fast "point at distance");
 *   • `journey`  – ONE long Polyline made of all legs glued end-to-end, so any
 *                  moment of the story can be expressed as "metres along the journey";
 *   • `legStart` / `legEnd` – where each leg begins/ends on that long line.
 *
 * WHY CORRECTIONS ARE NEEDED (the original file is not perfect)
 * ─────────────────────────────────────────────────────────────
 * 1. Small gaps. Consecutive legs do not always touch: e.g. the truck leg into
 *    Pittsburgh ends ~1.2 km away from where the walking leg through Pittsburgh
 *    starts, and the Jackson approach ends ~1.1 km from the start of the ride to
 *    Colorado. When everything is glued into one journey line, such a gap would
 *    become an invisible straight hop. We close it by starting each detailed leg
 *    exactly where the previous leg ended (one extra point is prepended).
 * 2. Jumps. Five features have only TWO points (start and end) — the original
 *    author hid or thinned them because the real path is unknown. A straight
 *    2-point line would look like a road through mountains and lakes, so we
 *    replace it with a smooth arc of 64 points that clearly reads as "a leap",
 *    starting exactly at the previous leg's end and finishing exactly at the next
 *    leg's start. The map draws it dashed with an arrow head.
 *
 * The original file is never modified; corrections happen in memory, in
 * `correctLegs()`, which is a pure function covered by unit tests.
 */
import type { Leg, LegMeta, LngLat } from '../data/types';
import { LEG_META, ROUTE_URL } from '../data/legs';
import { assetUrl } from '../config/assets';
import { Polyline, arcBetween, haversineMeters } from './polyline';

export interface Route {
  legs: readonly Leg[];
  /** One Polyline per leg (same order as `legs`). */
  legLines: readonly Polyline[];
  /** All legs concatenated into one continuous line. */
  journey: Polyline;
  /** legStart[i] = metres along `journey` where leg i begins. */
  legStart: readonly number[];
  /** legEnd[i] = metres along `journey` where leg i ends. */
  legEnd: readonly number[];
}

/** Minimal shape of the GeoJSON we read (we validate the parts we use). */
interface RouteFeatureCollection {
  type: 'FeatureCollection';
  features: { geometry: { type: string; coordinates: unknown } }[];
}

/** Gaps shorter than this (metres) are treated as "the same point" and not patched. */
const SNAP_TOLERANCE_M = 1;
/** How many segments a jump arc is made of (more = smoother curve). */
const ARC_SEGMENTS = 64;
/** How far an arc bows sideways, as a fraction of its length (time skip bows more). */
const JUMP_BULGE = 0.12;
const TIMESKIP_BULGE = 0.18;

/**
 * Type guard: returns true if `value` looks like [lng, lat].
 * ("Type guard" = a function whose `value is LngLat` return type teaches
 * TypeScript what the value is when the function returns true.)
 */
function isLngLat(value: unknown): value is LngLat {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  );
}

/**
 * Applies the corrections described at the top of this file.
 * Input and output: one coordinate list per leg, in route order.
 * Pure: never mutates its input.
 */
export function correctLegs(meta: readonly LegMeta[], raw: readonly (readonly LngLat[])[]): LngLat[][] {
  const out: LngLat[][] = [];
  for (let i = 0; i < meta.length; i++) {
    const kind = meta[i]!.kind;
    const points = raw[i]!;
    // Where the previous leg ended (after its own correction), if there is one.
    const previousEnd = i > 0 ? out[i - 1]!.at(-1)! : null;

    if (kind === 'jump' || kind === 'timeskip') {
      // Start where the previous leg really ended; end where the next leg really starts.
      const start = previousEnd ?? points[0]!;
      const nextRaw = raw[i + 1];
      const end = nextRaw ? nextRaw[0]! : points.at(-1)!;
      out.push(arcBetween(start, end, ARC_SEGMENTS, kind === 'timeskip' ? TIMESKIP_BULGE : JUMP_BULGE));
      continue;
    }

    // Detailed leg: prepend the previous end point if there is a gap, so the journey is continuous.
    const copy = points.map((p) => [p[0], p[1]] as const);
    if (previousEnd && haversineMeters(previousEnd, copy[0]!) > SNAP_TOLERANCE_M) copy.unshift(previousEnd);
    out.push(copy);
  }
  return out;
}

/**
 * Pure function (easy to test): GeoJSON + metadata → Route.
 * Throws a readable error if the file does not look like the expected route.
 */
export function buildRoute(geojson: unknown, meta: readonly LegMeta[] = LEG_META): Route {
  const fc = geojson as RouteFeatureCollection;
  if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
    throw new Error('Route file is not a GeoJSON FeatureCollection');
  }

  // 1) Read the raw coordinates of every leg (validating as we go).
  const raw = meta.map((m) => {
    const feature = fc.features[m.featureIndex];
    if (!feature || feature.geometry.type !== 'LineString' || !Array.isArray(feature.geometry.coordinates)) {
      throw new Error(`Route feature ${m.featureIndex} is missing or not a LineString`);
    }
    const coordinates = (feature.geometry.coordinates as unknown[]).filter(isLngLat).map((c) => [c[0], c[1]] as const);
    if (coordinates.length < 2) throw new Error(`Route feature ${m.featureIndex} has fewer than 2 points`);
    return coordinates;
  });

  // 2) Close gaps and turn jumps into arcs.
  const corrected = correctLegs(meta, raw);
  const legs: Leg[] = meta.map((m, i) => ({ ...m, coordinates: corrected[i]! }));
  const legLines = legs.map((leg) => new Polyline(leg.coordinates));

  // 3) Glue the legs into one journey line. Each leg now starts exactly where the
  //    previous one ended, so we skip that duplicated first point (except for leg 0).
  const all: LngLat[] = [];
  const legStart: number[] = [];
  const legEnd: number[] = [];
  const firstPointIndex: number[] = [];
  legs.forEach((leg, i) => {
    const skip = i > 0 ? 1 : 0;
    firstPointIndex.push(i > 0 ? all.length - 1 : 0); // shared point = previous leg's last point
    for (let k = skip; k < leg.coordinates.length; k++) all.push(leg.coordinates[k]!);
  });
  const journey = new Polyline(all);
  legs.forEach((leg, i) => {
    const startIndex = firstPointIndex[i]!;
    const endIndex = startIndex + leg.coordinates.length - 1;
    legStart.push(journey.cumulative[startIndex]!);
    legEnd.push(journey.cumulative[endIndex]!);
  });

  return { legs, legLines, journey, legStart, legEnd };
}

/** Downloads the route file and builds the Route. `signal` lets the caller cancel the download. */
export async function loadRoute(signal?: AbortSignal): Promise<Route> {
  const response = await fetch(assetUrl(ROUTE_URL), signal ? { signal } : {});
  if (!response.ok) throw new Error(`Could not load the route (${response.status})`);
  const json: unknown = await response.json();
  return buildRoute(json);
}
