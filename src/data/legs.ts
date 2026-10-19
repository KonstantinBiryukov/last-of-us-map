/**
 * legs.ts — metadata for each piece of the travelled route.
 *
 * The coordinates live in the original file public/server/info/test2.geojson
 * (17 LineString features, ~21 500 points, ~3 MB). That file is fetched at
 * runtime (so it never bloats the JavaScript bundle) and lightly corrected in
 * geo/route.ts (gaps closed, jumps turned into arcs). This file only says, for
 * each feature, WHAT KIND of line it is and HOW it was travelled.
 *
 * How the kinds were decided, from the original file's own properties:
 *   • Features with hundreds/thousands of points          → 'detailed'.
 *   • Features with only 2 points that the old app drew
 *     thin or hid (indices 4, 7, 12, 15)                   → 'jump'.
 *   • Feature 1 (Austin → Boston, hidden in the old app) is
 *     the twenty-year time skip before Chapter II           → 'timeskip'.
 *
 * Travel modes: 'canon' only where the game clearly shows that transport.
 * Everything else uses the documented default, 'walk', marked 'default'.
 *
 * IMPORTANT: the position of an entry in this array is its "leg index", used by
 * data/chapters.ts. Keep the order identical to the route (and the GeoJSON).
 */
import type { LegMeta, StreetRoute } from './types';

export const LEG_META: readonly LegMeta[] = [
  // 0 — Prologue: Tommy drives Joel and Sarah out of Austin.
  { featureIndex: 0, kind: 'detailed', mode: 'vehicle', modeSource: 'canon', note: 'Fleeing Austin by truck on outbreak night' },
  // 1 — The story jumps twenty years and 2 700 km to Boston.
  { featureIndex: 1, kind: 'timeskip', mode: 'walk', modeSource: 'default', note: 'Twenty years later — Austin to the Boston Quarantine Zone' },
  // 2 — On foot through Boston (QZ → docks → Fireflies → Downtown → Museum → Capitol, from
  //     the generated street route), then out of the city to Lincoln (original line).
  { featureIndex: 2, kind: 'detailed', mode: 'walk', modeSource: 'default', note: 'Out of Boston towards Lincoln', streets: { route: 'boston', at: 'start' } },
  // 3–5 — Bill's truck heading west to Pittsburgh (4 has no detailed path).
  { featureIndex: 3, kind: 'detailed', mode: 'vehicle', modeSource: 'canon', note: "Driving west in Bill's truck" },
  { featureIndex: 4, kind: 'jump', mode: 'vehicle', modeSource: 'canon', note: "Bill's truck, further west (no detailed path in the source data)" },
  { featureIndex: 5, kind: 'detailed', mode: 'vehicle', modeSource: 'canon', note: "Bill's truck, into Pittsburgh" },
  // 6 — Through Pittsburgh and out into the suburbs (shared by Chapters V and VI).
  { featureIndex: 6, kind: 'detailed', mode: 'walk', modeSource: 'default', note: 'On foot through Pittsburgh and its suburbs' },
  // 7 — Months pass: summer to fall, Pennsylvania to Wyoming.
  { featureIndex: 7, kind: 'jump', mode: 'walk', modeSource: 'default', note: 'Summer turns to fall — Pittsburgh to Wyoming (no detailed path in the source data)' },
  // 8 — Towards Tommy's dam near Jackson.
  { featureIndex: 8, kind: 'detailed', mode: 'walk', modeSource: 'default', note: "Towards Tommy's dam" },
  // 9–10 — On horseback to the university, then through the winter mountains.
  { featureIndex: 9, kind: 'detailed', mode: 'horse', modeSource: 'canon', note: 'Riding to the University of Eastern Colorado' },
  { featureIndex: 10, kind: 'detailed', mode: 'horse', modeSource: 'canon', note: 'Winter in the mountains' },
  // 11–13 — Leaving the mountains, a jump to Utah, then into Salt Lake City.
  { featureIndex: 11, kind: 'detailed', mode: 'walk', modeSource: 'default', note: 'Leaving the mountains' },
  { featureIndex: 12, kind: 'jump', mode: 'walk', modeSource: 'default', note: 'Winter turns to spring — Colorado to Utah (no detailed path in the source data)' },
  // 13 — continued (generated street route) from downtown to St. Mary's Hospital, the
  //      Fireflies' base — the real St. Mark's Hospital the game's hospital is based on.
  { featureIndex: 13, kind: 'detailed', mode: 'walk', modeSource: 'default', note: 'Into Salt Lake City', streets: { route: 'hospital', at: 'end' } },
  // 14–16 — Driving away from Salt Lake City, then the last stretch home to Jackson.
  //      14 starts at the hospital (generated driving route) and joins the original on I-80.
  { featureIndex: 14, kind: 'detailed', mode: 'vehicle', modeSource: 'canon', note: 'Driving away from Salt Lake City', streets: { route: 'escape', at: 'start' } },
  { featureIndex: 15, kind: 'jump', mode: 'vehicle', modeSource: 'default', note: 'North towards Wyoming (no detailed path in the source data)' },
  { featureIndex: 16, kind: 'detailed', mode: 'walk', modeSource: 'default', note: 'The last stretch home to Jackson' },
];

/** Where the original route file lives (relative to /public). */
export const ROUTE_URL = 'server/info/test2.geojson';
/** URL of a generated street route (scripts/build-street-routes.mjs). */
export function streetsUrl(route: StreetRoute): string {
  return `server/info/${route}-streets.geojson`;
}

/** All generated street routes the app loads. */
export const STREET_ROUTES: readonly StreetRoute[] = ['boston', 'hospital', 'escape'];
