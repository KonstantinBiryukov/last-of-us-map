/**
 * keyPoints.ts — WHERE each chapter key point's prop (data/keyPoints.ts) stands, and WHEN
 * the travellers pass it. Pure functions, computed once, covered by unit tests.
 *
 * THE RULES, in order of importance:
 *   1. Nobody walks through a prop: a prop's footprint keeps a clearance from EVERY travelled
 *      part of the route (also where the route doubles back, as in Boston), wide enough for
 *      the walking party even at the follow camera's widest zoom-out.
 *   2. Props never overlap each other — nor stand in front of an exact landmark (the bridge) as
 *      the north-looking camera sees it.
 *   3. Geographically right: a prop stands at the point of its chapter's route closest to its
 *      real place (`coord`), on the side of the route where that place lies.
 *   4. Size: based on the travellers' size at that spot (the follow camera's zoom there,
 *      followZoom.ts) × PROP_SCALE — and the SAME for neighbouring props (a GROUP: props
 *      near each other, seen at similar zooms), the smallest of theirs, so nearby buildings
 *      are in proportion (the giraffe is no taller than the hospital next to it).
 *
 * EXACT LANDMARKS (`exact`: Pittsburgh's yellow bridge, Tommy's dam): they stand exactly at
 * their coordinate, turned along the given heading, rules 1 and 3 aside. Placed
 * first with the close places; everything else avoids it.
 *
 * ARRIVAL BUILDINGS (`arrive`: the hospital): where the walk ends. The prop stands straight
 * ahead of the route's end (in the direction they arrive from), facing them, its front door a
 * step beyond where they stop — so they walk across its forecourt right up to the door, as if
 * entering. Placed first; others avoid it.
 *
 * CLOSE PLACES (`close`: Joel's house where the drive starts, the State House where the
 * Boston walk ends, the Fireflies' hospital): the travellers come right up to them, and rule 1
 * shrinks to "no route inside the footprint" — they brush right past. Best of all, the prop
 * stands EXACTLY on its real coordinate (the State House: its real site, between streets the
 * trio walks), at the largest size that keeps the route outside it. If the route runs right
 * through the real spot (the walk ends at the hospital; the drive starts at the house), it
 * stands CLOSE_CLEARANCE beside the route point passed at that moment instead (nudged at most
 * one footprint). They are placed first; the others then avoid them.
 *
 * WHICH PART OF THE ROUTE: only parts walked on foot when the chapter has any (every key
 * point is a place they explore on foot — snapping "downtown Pittsburgh" onto the fast drive
 * into the city would size the prop for a truck racing past), only parts after the previous
 * key point (so props come in the game's order), and on a tie the EARLIEST spot (the State
 * House is both where the Boston walk ends and where the walk to Lincoln starts).
 *
 * When the ideal spot breaks rule 1 or 2, we try, in this order: the other side of the
 * route; standing a little further out from the route (up to one more footprint); then
 * the same with the spot nudged half a footprint forwards/backwards, then one, one and a
 * half, two. If a group's props cannot all fit, the whole group tries a smaller size (down
 * to a quarter) — so sizes stay equal within a group.
 *
 * GEOMETRY: distances are measured on a small flat patch around each prop ("equirectangular":
 * east metres = Δlongitude × 111 320 × cos(latitude), north metres = Δlatitude × 111 320),
 * accurate to well under 1 % over the few kilometres that matter here.
 */
import type { Chapter, KeyPoint } from '../data/types';
import type { Route } from '../geo/route';
import { KEY_POINTS, PROP_RADIUS } from '../data/keyPoints';
import { metersPerPixel } from '../geo/mercator';
import { comfortableZoom } from './followZoom';
import { locate, type LegSpan, type Timeline } from './timeline';
import {
  closestDistance,
  DEG,
  distanceToSegment,
  flatDistance,
  METRES_PER_DEGREE,
  spanAt,
  timeFraction,
  travelledSegments,
  travelledSpans,
  type Segment,
} from './keyPointGeometry';

/** A key point placed beside the route. */
export interface KeyPointPlacement extends KeyPoint {
  /** Chapter it belongs to (0-based). */
  chapterIndex: number;
  /** Metres along the journey line where the travellers pass it. */
  distance: number;
  /** When they pass it, as a fraction (0‥1) of the chapter's playing time (story panel). */
  at: number;
  /** The prop's centre on the map. */
  lng: number;
  lat: number;
  /** Real metres per model metre: the prop's fixed size. */
  metresPerModel: number;
  /** Footprint radius in real metres (PROP_RADIUS × metresPerModel). */
  radiusMetres: number;
  /** Room kept for the travellers between the route and the footprint (real metres). */
  clearanceMetres: number;
  /** Which side of the route it stands on: +1 = right, −1 = left (facing the travel direction). */
  side: 1 | -1;
  /** Route direction where it stands, in degrees clockwise from north (to face the route). */
  bearing: number;
  /** A "close" place: right beside the route (see CLOSE PLACES above). */
  close: boolean;
  /** For an `exact` landmark: its fixed heading (degrees from north); the prop is turned along it. */
  heading?: number;
  /**
   * For a landmark the travellers CROSS (the bridge): the stretch of the journey (metres, from–to)
   * during which they are drawn walking straight along its deck, and the deck's two ends
   * ([lng, lat], in the order they are walked). See BRIDGE CROSSING in three/JourneyLayer.ts.
   */
  crossing?: { from: number; to: number; start: [number, number]; end: [number, number] };
}

/**
 * Clear space between a prop's edge and the route's centre line, in model metres (×
 * metresPerModel). The walking party is ~1.4 model metres wide each side of the route at the
 * follow camera's zoom, and up to twice that at its widest zoom-out — 3 covers both.
 */
const TRAVELLER_CLEARANCE = 3;
/** The much smaller room kept beside `close` places (model metres): the travellers brush past. */
const CLOSE_CLEARANCE = 1;
/** Half the deck length (model metres) of props the travellers cross (see props.ts: the bridge deck is 4.6 long). */
const DECK_HALF_LENGTH = { bridge: 2.3 } as const;
/**
 * Arrival buildings: how far back (m) the arrival direction is measured, and where the walk
 * stops, in model metres from the building's centre: 0.9 = just outside the hospital's front
 * wall (its front is 0.7 in front of the centre, see props.ts), on its forecourt — right at
 * the door, as if they are about to walk in.
 */
const ARRIVE_LOOKBACK_M = 1500;
const ARRIVE_STOP_MODEL = 0.9;
/** How deep (in landmark radii) the clear view corridor in front of an exact landmark is. */
const VIEW_CORRIDOR = 5;
/** Extra space kept between two props (model metres). */
const PROP_GAP = 0.6;
/** The walking travellers' on-screen height (px) and model height (m), as in JourneyLayer. */
const TRAVELLER_SCREEN_PX = 81;
const TRAVELLER_MODEL_M = 1.85;
/** Prop sizes tried, largest first (1 = the travellers' size). */
const SIZES = [1, 0.8, 0.65, 0.5, 0.4, 0.33, 0.25];
/** Nudges along the route tried, in full-size footprint widths (0 = the ideal spot first). */
const SHIFTS = [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2, -2];
/** Nudges allowed for `close` places (smaller: they mark a moment of the story). */
const CLOSE_SHIFTS = [0, 0.5, -0.5, 1, -1];
/** How far from its real coordinate a close place may stand and still count as on its site (m). */
const REAL_SITE_METRES = 120;
/**
 * Props this close (in units of their combined footprint radii) form a GROUP sharing one size,
 * unless their travellers' scales differ more than GROUP_MAX_SCALE_RATIO (such places are seen
 * at very different zooms, never side by side).
 */
const GROUP_DISTANCE = 20;
const GROUP_MAX_SCALE_RATIO = 4;
/**
 * Props are drawn at this multiple of the travellers' scale (a house ~3 model metres tall then
 * stands well above the travellers without dwarfing them). 1.15 with the 81-px travellers
 * keeps the props' size from when the travellers were 58 px and props 1.6×.
 */
const PROP_SCALE = 1.15;
/** How much further from the route than the minimum a prop may stand, in half footprints. */
const FURTHER_OUT = [0, 1, 2];

/**
 * Would a prop at (lng, lat) with footprint `radius` stand in front of `landmark` as the follow
 * camera sees it? Only exact landmarks the travellers cross (the bridge) count. The camera looks north (tilted), so
 * "in front" is a corridor running SOUTH from the landmark: VIEW_CORRIDOR landmark radii deep,
 * as wide as the landmark plus the prop. Tall downtown towers there hid Pittsburgh's bridge.
 */
function blocksView(lng: number, lat: number, radius: number, landmark: KeyPointPlacement): boolean {
  // Only landmarks the travellers cross (the bridge) need the clear view; the dam does not.
  if (landmark.heading === undefined || !(landmark.prop in DECK_HALF_LENGTH)) return false;
  const kx = METRES_PER_DEGREE * Math.cos(landmark.lat * DEG);
  const east = (lng - landmark.lng) * kx;
  const north = (lat - landmark.lat) * METRES_PER_DEGREE;
  return north < 0 && north > -VIEW_CORRIDOR * landmark.radiusMetres && Math.abs(east) < landmark.radiusMetres + radius;
}

/** Everything known about a key point before its final spot is chosen. */
interface Candidate {
  keyPoint: KeyPoint;
  chapterIndex: number;
  /** Order in the data (chapters in order, points in game order). */
  order: number;
  /** Ideal route spot (distance along the journey) and the route part it lies on. */
  ideal: number;
  span: LegSpan;
  /** The walking travellers' metres per model metre at the follow camera's zoom here. */
  travellerScale: number;
  /** Room kept for the travellers between the route and a prop (real metres). */
  clearance: number;
  /** Side of the route the real place lies on. */
  preferred: 1 | -1;
  /** Travelled route pieces near enough to matter for collisions. */
  nearby: Segment[];
}

export function placeKeyPoints(
  timeline: Timeline,
  chapters: readonly Chapter[],
  route: Route,
  keyPoints: Readonly<Record<number, readonly KeyPoint[]>> = KEY_POINTS,
): KeyPointPlacement[] {
  const segments = travelledSegments(route);
  const point: [number, number] = [0, 0];

  // ── 1. The ideal spot, the travellers' scale and the preferred side of every key point ──
  const candidates: Candidate[] = [];
  const spansOf: LegSpan[][] = [];
  chapters.forEach((chapter, chapterIndex) => {
    const travelled = travelledSpans(timeline, chapterIndex);
    // Props stand by the WALKED parts when a chapter has some (Pittsburgh: by the walk, not the
    // drive). Joel's run with Sarah (`carry`, Hometown) does not count as one: it is the end of
    // the escape drive, and its props (the house, the burning house) stand along the drive.
    const walked = travelled.filter((s) => s.mode === 'walk' && !s.carry);
    const spans = walked.length > 0 ? walked : travelled;
    spansOf[chapterIndex] = [...spans];
    let previousIdeal = -Infinity; // ideal spots must follow the game order
    for (const keyPoint of keyPoints[chapter.number] ?? []) {
      // The moment it is reached: given in the data (`moment`), or when they pass closest to it.
      const ideal =
        keyPoint.moment !== undefined
          ? locate(timeline, timeline.chapters[chapterIndex]!.start + (timeline.chapters[chapterIndex]!.end - timeline.chapters[chapterIndex]!.start) * keyPoint.moment).distance
          : closestDistance(route, spans, keyPoint.coord, previousIdeal);
      previousIdeal = ideal;
      const span = spanAt(spans, ideal)!;
      route.journey.pointAt(ideal, point);
      const zoom = comfortableZoom(span, route.legs[span.legIndex]!.coordinates[0]![1]);
      const travellerScale = (TRAVELLER_SCREEN_PX * metersPerPixel(zoom, point[1])) / TRAVELLER_MODEL_M;
      const b = route.journey.bearingAt(ideal, 300) * DEG;
      const kx = METRES_PER_DEGREE * Math.cos(point[1] * DEG);
      const towardsEast = (keyPoint.coord[0] - point[0]) * kx;
      const towardsNorth = (keyPoint.coord[1] - point[1]) * METRES_PER_DEGREE;
      // Facing bearing b, "right" is (east, north) = (cos b, −sin b).
      const preferred: 1 | -1 = towardsEast * Math.cos(b) - towardsNorth * Math.sin(b) >= 0 ? 1 : -1;
      // Only route pieces near enough to matter (a cheap box around the spot, ±30 footprints).
      const reach = (PROP_RADIUS[keyPoint.prop] + TRAVELLER_CLEARANCE) * travellerScale * 30;
      const dLng = reach / kx;
      const dLat = reach / METRES_PER_DEGREE;
      const nearby = segments.filter(
        (s) =>
          Math.max(s[0], s[2]) > point[0] - dLng &&
          Math.min(s[0], s[2]) < point[0] + dLng &&
          Math.max(s[1], s[3]) > point[1] - dLat &&
          Math.min(s[1], s[3]) < point[1] + dLat,
      );
      candidates.push({
        keyPoint,
        chapterIndex,
        order: candidates.length,
        ideal,
        span,
        travellerScale,
        clearance: (keyPoint.close ? CLOSE_CLEARANCE : TRAVELLER_CLEARANCE) * travellerScale,
        preferred,
        nearby,
      });
    }
  });

  // Story order of a placed prop (to keep the game order within a chapter).
  const orderByName = new Map(candidates.map((c) => [`${c.chapterIndex}:${c.keyPoint.name}`, c.order]));
  const orderOfName = (p: KeyPointPlacement): number => orderByName.get(`${p.chapterIndex}:${p.name}`)!;

  // ── 2. Groups of neighbouring props share one size (see GROUPS in the file header) ──
  const group = candidates.map((_, i) => i); // union-find: each candidate's group leader
  const leader = (i: number): number => (group[i] === i ? i : (group[i] = leader(group[i]!)));
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i]!;
      const c = candidates[j]!;
      const ratio = Math.max(a.travellerScale, c.travellerScale) / Math.min(a.travellerScale, c.travellerScale);
      if (ratio > GROUP_MAX_SCALE_RATIO) continue; // very different zooms are never seen together
      route.journey.pointAt(a.ideal, point);
      const [aLng, aLat] = point;
      route.journey.pointAt(c.ideal, point);
      const reachA = PROP_RADIUS[a.keyPoint.prop] * a.travellerScale;
      const reachC = PROP_RADIUS[c.keyPoint.prop] * c.travellerScale;
      if (flatDistance(aLng, aLat, point[0], point[1]) < GROUP_DISTANCE * (reachA + reachC)) group[leader(j)] = leader(i);
    }
  }
  const groups = new Map<number, Candidate[]>();
  candidates.forEach((c, i) => {
    const key = leader(i);
    groups.set(key, [...(groups.get(key) ?? []), c]);
  });
  // A group's base size: its smallest travellers' scale (so nothing in it is oversized).
  const baseOf = new Map<Candidate, number>();
  for (const members of groups.values()) {
    const base = Math.min(...members.map((c) => c.travellerScale)) * PROP_SCALE;
    for (const c of members) baseOf.set(c, base * (c.keyPoint.scale ?? 1)); // + the point's own size factor
  }

  // ── 3. Choose the spots: walk-in buildings first (they cannot move), then group by group ──
  const placed: KeyPointPlacement[] = [];
  const lastDistance: number[] = chapters.map(() => -Infinity); // per chapter: keep the game order

  const make = (c: Candidate, d: number, span: LegSpan, lng: number, lat: number, size: number, side: 1 | -1, bearing: number): KeyPointPlacement => ({
    ...c.keyPoint,
    chapterIndex: c.chapterIndex,
    distance: d,
    at: timeFraction(timeline, c.chapterIndex, span, d),
    lng,
    lat,
    metresPerModel: size,
    radiusMetres: PROP_RADIUS[c.keyPoint.prop] * size,
    clearanceMetres: c.clearance,
    side,
    bearing,
    close: c.keyPoint.close === true,
  });

  /** Tries to place one prop at size `size`; returns its placement or null when nothing fits. */
  const tryPlace = (
    c: Candidate,
    size: number,
    others: readonly KeyPointPlacement[],
    shifts: readonly number[] = c.keyPoint.close ? CLOSE_SHIFTS : SHIFTS,
  ): KeyPointPlacement | null => {
    const radius = PROP_RADIUS[c.keyPoint.prop] * size;
    const step = 2 * (radius + c.clearance); // one footprint width (with the travellers' room)
    const spans = spansOf[c.chapterIndex]!;
    // A close place may only be nudged a little (it marks a moment); others a bit more.
    for (const shift of shifts) {
      const d = c.ideal + shift * step;
      // Stay on the chapter's (walked) route, in the game order: after the chapter's previous
      // key point, and before any later key point of the chapter already placed (a close one).
      const span = spanAt(spans, d);
      if (!span || d <= lastDistance[c.chapterIndex]!) continue;
      if (placed.some((p) => p.chapterIndex === c.chapterIndex && orderOfName(p) > c.order && d >= p.distance)) continue;
      route.journey.pointAt(d, point);
      const bearing = route.journey.bearingAt(d, 300);
      const b = bearing * DEG;
      for (const side of [c.preferred, -c.preferred as 1 | -1]) {
        for (const further of c.keyPoint.close ? [0] : FURTHER_OUT) {
          const out = c.clearance + radius + further * (radius + c.clearance) * 0.5;
          const lng = point[0] + (Math.cos(b) * out * side) / (METRES_PER_DEGREE * Math.cos(point[1] * DEG));
          const lat = point[1] + (-Math.sin(b) * out * side) / METRES_PER_DEGREE;
          // Rule 1: the travelled route keeps clear of the footprint (1 % tolerance: the spot
          // it was pushed out from may be exactly at the limit). A close place only needs the
          // route to stay outside the footprint itself — the travellers brush right past it
          // (the State House stands between two streets they walk).
          const need = c.keyPoint.close ? radius * 0.98 : (radius + c.clearance) * 0.99;
          if (c.nearby.some((s) => distanceToSegment(lng, lat, s) < need)) continue;
          // Rule 2: no overlap with other props.
          if (others.some((p) => flatDistance(lng, lat, p.lng, p.lat) < radius + p.radiusMetres + PROP_GAP * size)) continue;
          // Rule 2b: keep the view to a landmark clear — not in front of it as the camera sees it.
          if (others.some((p) => blocksView(lng, lat, radius, p))) continue;
          return make(c, d, span, lng, lat, size, side, bearing);
        }
      }
    }
    return null;
  };

  // Close places first (each at the largest size that fits), so the others keep clear of them.
  // If their group later has to go smaller, they are shrunk to match (see below).
  const keyOf = (c: Candidate) => `${c.chapterIndex}:${c.keyPoint.name}`;
  const closeFactor = new Map<string, number>();
  /**
   * A close place standing EXACTLY on its real coordinate, at the largest size that keeps every
   * travelled route line outside its footprint, turned to face the route point the travellers
   * pass. Null when the route runs too close (e.g. the walk ends right at the hospital).
   */
  const placeAtRealSpot = (c: Candidate, size: number): KeyPointPlacement | null => {
    const radius = PROP_RADIUS[c.keyPoint.prop] * size;
    // The real coordinate, or failing that a spot within REAL_SITE_METRES of it (nearest first):
    // still on the real site, just clear of the streets around it.
    const [realLng, realLat] = c.keyPoint.coord;
    const kxReal = METRES_PER_DEGREE * Math.cos(realLat * DEG);
    const spots: [number, number][] = [[realLng, realLat]];
    for (const metres of [REAL_SITE_METRES / 2, REAL_SITE_METRES]) {
      for (let k = 0; k < 8; k++) {
        const angle = (k * Math.PI) / 4;
        spots.push([realLng + (Math.cos(angle) * metres) / kxReal, realLat + (Math.sin(angle) * metres) / METRES_PER_DEGREE]);
      }
    }
    const spot = spots.find(
      ([lng, lat]) =>
        !c.nearby.some((s) => distanceToSegment(lng, lat, s) < radius * 0.98) &&
        !placed.some((p) => flatDistance(lng, lat, p.lng, p.lat) < radius + p.radiusMetres + PROP_GAP * size),
    );
    if (!spot) return null;
    const [lng, lat] = spot;
    route.journey.pointAt(c.ideal, point);
    // Which side of the passing travellers it stands on, and their direction there.
    const bearing = route.journey.bearingAt(c.ideal, 300);
    const b = bearing * DEG;
    const kx = METRES_PER_DEGREE * Math.cos(point[1] * DEG);
    const right = (lng - point[0]) * kx * Math.cos(b) - (lat - point[1]) * METRES_PER_DEGREE * Math.sin(b);
    return make(c, c.ideal, c.span, lng, lat, size, right >= 0 ? 1 : -1, bearing);
  };

  /** The same placement at another size (an exact landmark never moves). */
  const resizeInPlace = (p: KeyPointPlacement, c: Candidate, size: number): KeyPointPlacement => ({
    ...p,
    metresPerModel: size,
    radiusMetres: PROP_RADIUS[c.keyPoint.prop] * size,
  });

  // Arrival buildings (the hospital): straight ahead of the route's end, facing the travellers.
  for (const c of candidates) {
    if (!c.keyPoint.arrive) continue;
    const size = baseOf.get(c)!;
    // The direction they arrive from: the last ~ARRIVE_LOOKBACK_M metres of their route.
    const end: [number, number] = [0, 0];
    route.journey.pointAt(c.ideal, end);
    route.journey.pointAt(Math.max(0, c.ideal - ARRIVE_LOOKBACK_M), point);
    const kx = METRES_PER_DEGREE * Math.cos(end[1] * DEG);
    const east = (end[0] - point[0]) * kx;
    const north = (end[1] - point[1]) * METRES_PER_DEGREE;
    const length = Math.hypot(east, north) || 1;
    // Centre: ARRIVE_STOP_MODEL beyond the end, so its front door is a step ahead of where they stop.
    const out = ARRIVE_STOP_MODEL * size;
    const lng = end[0] + ((east / length) * out) / kx;
    const lat = end[1] + ((north / length) * out) / METRES_PER_DEGREE;
    const arrivalBearing = (Math.atan2(east, north) * 180) / Math.PI;
    // Facing back towards them: the prop's front (−Z) points opposite to their direction.
    placed.push({ ...make(c, c.ideal, c.span, lng, lat, size, 1, arrivalBearing), heading: arrivalBearing + 180 });
    closeFactor.set(keyOf(c), 1);
  }

  // Exact landmarks (a bridge): exactly in place, along their real axis, at their group's size.
  for (const c of candidates) {
    if (!c.keyPoint.exact) continue;
    const [lng, lat] = c.keyPoint.coord;
    const size = baseOf.get(c)!;
    placed.push({ ...make(c, c.ideal, c.span, lng, lat, size, 1, c.keyPoint.exact.heading), heading: c.keyPoint.exact.heading });
    closeFactor.set(keyOf(c), 1);
  }

  for (const c of candidates) {
    if (!c.keyPoint.close) continue;
    // Best: on its real site (largest size that fits, down to a third).
    const exact = SIZES.filter((size) => size >= 0.33)
      .map((size) => placeAtRealSpot(c, baseOf.get(c)! * size))
      .find((p) => p !== null);
    if (exact) {
      placed.push(exact);
      closeFactor.set(keyOf(c), exact.metresPerModel / baseOf.get(c)!);
      continue;
    }
    // Otherwise beside the route: every size at the exact moment's spot, before any nudge.
    search: for (const shift of CLOSE_SHIFTS) {
      for (const size of SIZES) {
        const p = tryPlace(c, baseOf.get(c)! * size, placed, [shift]);
        if (p) {
          placed.push(p);
          closeFactor.set(keyOf(c), size);
          break search;
        }
      }
    }
  }
  const closePlaced = new Set(closeFactor.keys());

  // Groups in story order; inside a group, one shared size: the largest at which ALL its props fit.
  const ordered = [...groups.values()].sort((a, b) => a[0]!.order - b[0]!.order);
  for (const members of ordered) {
    const free = members.filter((c) => !closePlaced.has(keyOf(c)));
    if (free.length === 0) continue;
    let chosen: KeyPointPlacement[] | null = null;
    let chosenSize = SIZES.at(-1)!;
    const closeMembers = members.filter((c) => closePlaced.has(keyOf(c)));
    for (const size of SIZES) {
      const savedLast = [...lastDistance];
      // At this size, the group's close places shrink too if they are bigger (same spot rule).
      const base = placed.map((p) => {
        const c = closeMembers.find((m) => m.chapterIndex === p.chapterIndex && m.keyPoint.name === p.name);
        if (!c || closeFactor.get(keyOf(c))! <= size) return p;
        if (p.heading !== undefined) return resizeInPlace(p, c, baseOf.get(c)! * size); // exact: stays put
        return tryPlace(c, baseOf.get(c)! * size, placed.filter((q) => q !== p)) ?? p;
      });
      const attempt: KeyPointPlacement[] = [];
      for (const c of free) {
        const p = tryPlace(c, baseOf.get(c)! * size, [...base, ...attempt]);
        if (!p) break;
        attempt.push(p);
        lastDistance[c.chapterIndex] = p.distance;
      }
      if (attempt.length === free.length) {
        chosen = attempt;
        chosenSize = size;
        placed.splice(0, placed.length, ...base); // keep the shrunk close places
        break;
      }
      lastDistance.splice(0, lastDistance.length, ...savedLast); // undo, try smaller
    }
    if (!chosen) {
      // Nothing fits even at the smallest size (never happens with the current data — tested):
      // put each at its ideal spot, smallest size, so it still shows.
      chosen = free.map((c) => {
        const size = baseOf.get(c)! * SIZES.at(-1)!;
        route.journey.pointAt(c.ideal, point);
        const b = route.journey.bearingAt(c.ideal, 300) * DEG;
        const out = c.clearance + PROP_RADIUS[c.keyPoint.prop] * size;
        const lng = point[0] + (Math.cos(b) * out * c.preferred) / (METRES_PER_DEGREE * Math.cos(point[1] * DEG));
        const lat = point[1] + (-Math.sin(b) * out * c.preferred) / METRES_PER_DEGREE;
        return make(c, c.ideal, c.span, lng, lat, size, c.preferred, b / DEG);
      });
    }
    placed.push(...chosen);
    // Shrink the group's close places to the group's size, if it had to go smaller than them.
    for (const c of members.filter((c) => (closeFactor.get(keyOf(c)) ?? 0) > chosenSize)) {
      const index = placed.findIndex((p) => p.chapterIndex === c.chapterIndex && p.name === c.keyPoint.name);
      const current = placed[index]!;
      if (current.heading !== undefined) {
        placed[index] = resizeInPlace(current, c, baseOf.get(c)! * chosenSize); // exact: stays put
        continue;
      }
      const others = placed.filter((_, i) => i !== index);
      const smaller = tryPlace(c, baseOf.get(c)! * chosenSize, others);
      if (smaller) placed[index] = smaller;
    }
  }

  // Bridge crossings: the deck's length at its final size, centred on the moment they pass it.
  for (const [i, p] of placed.entries()) {
    if (p.heading === undefined || !(p.prop in DECK_HALF_LENGTH)) continue;
    const half = DECK_HALF_LENGTH[p.prop as keyof typeof DECK_HALF_LENGTH]! * p.metresPerModel;
    const h = p.heading * DEG;
    const kx = METRES_PER_DEGREE * Math.cos(p.lat * DEG);
    // The deck's ends: ± half its length along its heading (east = sin, north = cos).
    const a: [number, number] = [p.lng + (Math.sin(h) * half) / kx, p.lat + (Math.cos(h) * half) / METRES_PER_DEGREE];
    const b: [number, number] = [p.lng - (Math.sin(h) * half) / kx, p.lat - (Math.cos(h) * half) / METRES_PER_DEGREE];
    const from = Math.max(0, p.distance - half);
    const to = Math.min(route.journey.length, p.distance + half);
    // Walk it from the end nearer to where they come from.
    route.journey.pointAt(from, point);
    const aFirst = flatDistance(point[0], point[1], a[0], a[1]) <= flatDistance(point[0], point[1], b[0], b[1]);
    placed[i] = { ...p, crossing: { from, to, start: aFirst ? a : b, end: aFirst ? b : a } };
  }

  // Back in story order (chapters, then the game order inside each).
  const orderOf = new Map(candidates.map((c) => [`${c.chapterIndex}:${c.keyPoint.name}`, c.order]));
  const order = (p: KeyPointPlacement) => orderOf.get(`${p.chapterIndex}:${p.name}`)!;
  return placed.sort((a, b) => order(a) - order(b));
}

/** Placements are computed once per timeline and shared (3D layer and story panel). */
const cache = new WeakMap<Timeline, KeyPointPlacement[]>();

export function keyPointPlacements(timeline: Timeline, chapters: readonly Chapter[], route: Route): KeyPointPlacement[] {
  let placements = cache.get(timeline);
  if (!placements) {
    placements = placeKeyPoints(timeline, chapters, route);
    cache.set(timeline, placements);
  }
  return placements;
}
