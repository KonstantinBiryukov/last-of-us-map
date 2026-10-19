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
 * 3. Boston on the spot. The original Boston section of leg 2 meanders back and
 *    forth within ~1 km of downtown, so the travellers seemed to walk in place. It is
 *    replaced by a street route through the game's places (QZ → docks → Fireflies →
 *    Downtown → Museum → Capitol), generated once from the Mapbox Directions API
 *    (scripts/build-street-routes.mjs → boston-streets.geojson). The original line is
 *    re-joined at its point closest to the Capitol (the State House) and followed from
 *    there to Lincoln. See `spliceStart()`.
 * 4. Salt Lake City ends early. The original line stops downtown; the game ends at the
 *    Fireflies' hospital (St. Mary's, based on the real St. Mark's Hospital, ~10 km
 *    away). A generated street route continues the leg there (`appendEnd()`), and a
 *    generated driving route starts the drive away (leg 14) at the hospital, joining the
 *    original line on I-80 (`spliceStart()` again).
 *
 * The original file is never modified; corrections happen in memory, in pure
 * functions covered by unit tests.
 */
import type { Leg, LegMeta, LngLat, StreetRoute } from '../data/types';
import { LEG_META, ROUTE_URL, STREET_ROUTES, streetsUrl } from '../data/legs';
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
 * Replaces the start of `original` with `replacement`: finds the point of `original`
 * closest to the replacement's last point, and returns replacement + original from there.
 * Example: Boston street route (ends at the State House) + the original Boston → Lincoln
 * line from its point nearest the State House onwards.
 */
export function spliceStart(original: readonly LngLat[], replacement: readonly LngLat[]): LngLat[] {
  const end = replacement.at(-1)!;
  let best = 0;
  let bestDistance = Infinity;
  original.forEach((p, i) => {
    const d = haversineMeters(p, end);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  });
  return [...replacement, ...original.slice(best + 1)];
}

/** Continues `original` with `extension`, whose first point is the original's last point. */
export function appendEnd(original: readonly LngLat[], extension: readonly LngLat[]): LngLat[] {
  return [...original, ...extension.slice(1)];
}

/** Reads the LineString out of a generated *-streets.geojson file (validated). */
function streetsLine(geojson: unknown, route: StreetRoute): LngLat[] {
  const fc = geojson as RouteFeatureCollection | undefined;
  const line = fc?.features?.find((f) => f.geometry.type === 'LineString');
  if (!line || !Array.isArray(line.geometry.coordinates)) throw new Error(`Street route "${route}" is missing its LineString`);
  return (line.geometry.coordinates as unknown[]).filter(isLngLat).map((c) => [c[0], c[1]] as const);
}

/** The generated street route files, by name (any may be missing). */
export type StreetRouteFiles = Partial<Record<StreetRoute, unknown>>;

/**
 * Pure function (easy to test): GeoJSON + metadata → Route.
 * `streets` are the generated street routes (optional: a missing one leaves that leg as in
 * the original file). Throws a readable error if a file looks wrong.
 */
export function buildRoute(geojson: unknown, meta: readonly LegMeta[] = LEG_META, streets: StreetRouteFiles = {}): Route {
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
    let coordinates: LngLat[] = (feature.geometry.coordinates as unknown[]).filter(isLngLat).map((c) => [c[0], c[1]] as const);
    if (coordinates.length < 2) throw new Error(`Route feature ${m.featureIndex} has fewer than 2 points`);
    const file = m.streets ? streets[m.streets.route] : undefined;
    if (m.streets && file !== undefined) {
      const line = streetsLine(file, m.streets.route);
      coordinates = m.streets.at === 'start' ? spliceStart(coordinates, line) : appendEnd(coordinates, line);
    }
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

/** Downloads the route file and the street routes (in parallel) and builds the Route. */
export async function loadRoute(signal?: AbortSignal): Promise<Route> {
  const init = signal ? { signal } : {};
  const [routeResponse, ...streetResponses] = await Promise.all([
    fetch(assetUrl(ROUTE_URL), init),
    ...STREET_ROUTES.map((name) => fetch(assetUrl(streetsUrl(name)), init)),
  ]);
  if (!routeResponse!.ok) throw new Error(`Could not load the route (${routeResponse!.status})`);
  const json: unknown = await routeResponse!.json();
  // Street routes are improvements, not requirements: a missing one keeps the original line.
  const streets: StreetRouteFiles = {};
  for (const [i, name] of STREET_ROUTES.entries()) {
    const response = streetResponses[i]!;
    if (response.ok) streets[name] = await response.json();
  }
  return buildRoute(json, LEG_META, streets);
}
