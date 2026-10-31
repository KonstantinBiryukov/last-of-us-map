/**
 * build-street-routes.mjs — one-off data generator for walking routes along real streets.
 *
 *   npm run build:streets -- boston     → public/server/info/boston-streets.geojson
 *   npm run build:streets -- hospital   → public/server/info/hospital-streets.geojson
 *   npm run build:streets -- escape     → public/server/info/escape-streets.geojson
 *   npm run build:streets -- pittsburgh → public/server/info/pittsburgh-streets.geojson
 *
 * WHY
 *   boston   – the original route's Boston section meanders within ~1 km of downtown,
 *              so Joel and Ellie looked like they were walking on the spot. This route
 *              goes THROUGH the game's Boston places instead.
 *   hospital – the original route ends in downtown Salt Lake City; the game's last stop,
 *              the Fireflies' hospital (St. Mary's; here the University of Utah Hospital),
 *              is further on. This route continues there, past Liberty Park (the giraffe).
 *   pittsburgh – the original walk wandered back and forth around the river front. This route
 *              starts where they leave Bill's truck near Monroeville, walks into the city through the game's places
 *              and crosses the Roberto Clemente Bridge straight to the North Side.
 *   escape   – the drive away (Epilogue): this DRIVING route takes Joel and Ellie from the
 *              hospital north through Idaho Falls and east along the Snake River to Alpine,
 *              where the original road home to Jackson goes on.
 *
 * HOW: for each pair of consecutive stops it asks the Mapbox Directions API (walking
 * profile, or driving for `escape`) for the street path, joins the pieces into one line and writes a GeoJSON with
 * that LineString plus one Point per stop carrying `distanceAlong` (metres from the start).
 * The app splices these lines into the route (see geo/route.ts); the original route file
 * is never modified.
 *
 * Re-running a route can change its geometry slightly (map data updates), so only rebuild
 * the one you need; the chapter split points in data/chapters.ts are measured on the
 * committed files and checked by unit tests.
 *
 * The game's places are fictionalised; each stop is a real place chosen to match the
 * story (noted in `basis`). Your Mapbox token is read from .env.local.
 */
import { readFileSync, writeFileSync } from 'node:fs';

/** Boston stops in story order: Chapter II (Quarantine Zone) then Chapter III (The Outskirts). */
const BOSTON_STOPS = [
  { id: 'qz', name: 'Boston Quarantine Zone', basis: 'North End (the wiki: the QZ corresponds to the North End)', coord: [-71.0547, 42.3637] },
  { id: 'docks', name: "Robert's place at the docks", basis: 'Waterfront / Long Wharf', coord: [-71.051, 42.3604] },
  { id: 'fireflies', name: 'The Fireflies — Marlene hands over Ellie', basis: 'Government Center', coord: [-71.0592, 42.3597] },
  { id: 'wall', name: 'Beyond the wall', basis: 'Cambridge Street, the edge of the zone', coord: [-71.0625, 42.3608] },
  { id: 'downtown', name: 'Downtown', basis: 'Downtown Crossing', coord: [-71.0603, 42.3555] },
  { id: 'museum', name: 'The Museum', basis: 'Old State House (a museum; the game’s museum is fictional)', coord: [-71.0575, 42.3588] },
  { id: 'capitol', name: 'The Capitol Building', basis: 'Massachusetts State House', coord: [-71.0637, 42.3588] },
];

/**
 * Salt Lake City: from where the original route ends (downtown, the last point of feature 13
 * of test2.geojson) to the Fireflies' hospital, on the University of Utah campus (the user's
 * map of the game's places). The props here are large (sized to match the travellers, who are
 * drawn at a fixed screen size), so the walk never doubles back beside one of them:
 *   • south down State Street, well west of Liberty Park;
 *   • east along 1300 South, then NORTH up 1100 East past Liberty Park — the site of the old
 *     zoo — with the giraffe on their left (west), as when they walked north past it before:
 *     they only turn a quarter round to pet it (walking south, it was behind them);
 *   • on north up into the Avenues, east, and down University Street (a loop that gives the
 *     walk to the hospital its length, so the camera does not follow it from too close and the
 *     hospital is in view as they come), then the last stretch heading
 *     south-east to the hospital, as they came to St. Mark's before: the hospital faces
 *     north-west (back along their way), shows the north-up camera its back wall with the
 *     Fireflies' sign, then its front with Marlene. It stands on the south part of the campus,
 *     where the ground is nearly flat: a prop rests on the highest ground under it, and nearer
 *     the mountain it was lifted above the travellers at its door.
 * The University of Utah Hospital's position comes from the Mapbox Search Box API.
 */
const HOSPITAL_STOPS = [
  { id: 'downtown-slc', name: 'Downtown Salt Lake City', basis: 'end of the original route', coord: [-111.897697, 40.771461] },
  { id: 'state-street', name: 'South down State Street', basis: 'State Street at 200 South', coord: [-111.888, 40.765] },
  { id: 'state-1300-south', name: 'East along 1300 South', basis: 'State Street at 1300 South', coord: [-111.888, 40.7417] },
  { id: '1100-east', name: 'North up 1100 East', basis: '1100 East at 1300 South', coord: [-111.8593, 40.7417] },
  { id: 'liberty-park', name: 'Past Liberty Park', basis: '1100 East at 400 South, past the park', coord: [-111.8593, 40.76] },
  { id: 'avenues', name: 'Up into the Avenues', basis: '1100 East at 3rd Avenue', coord: [-111.8593, 40.7745] },
  { id: 'avenues-east', name: 'East through the Avenues', basis: 'University Street at 3rd Avenue', coord: [-111.8475, 40.7745] },
  { id: 'campus', name: 'Down to the campus', basis: 'University Street at 100 South, north-west of the hospital', coord: [-111.8475, 40.767] },
  { id: 'hospital', name: "St. Mary's Hospital — the Fireflies", basis: 'the south part of the University of Utah campus', coord: [-111.842, 40.76] },
];

/**
 * The drive away (Epilogue): from the hospital north on I-15 to Idaho Falls, east on US-26
 * along the Snake River through Swan Valley and past Palisades to Alpine, Wyoming — where it
 * joins the original route home (feature 16, its point 731, 1.2 km south of Alpine's centre),
 * which goes on through the Snake River Canyon to Jackson (`trimStartAt` in data/legs.ts).
 * Swan Valley is a waypoint so the route keeps to US-26 along the river. Out of the city it
 * goes over Capitol Hill and up Beck Street (US-89) to I-15 north of the city — not downtown
 * onto I-15 by Salt Lake Central Station, where it ran through the bus depot.
 */
const ESCAPE_STOPS = [
  { id: 'hospital', name: "St. Mary's Hospital", basis: 'the University of Utah campus (where the walk ends)', coord: [-111.842, 40.76] },
  { id: 'capitol-hill', name: 'Over Capitol Hill', basis: 'Victory Road, behind the State Capitol', coord: [-111.8935, 40.79] },
  { id: 'beck-street', name: 'North up Beck Street', basis: 'US-89 (Beck Street), north of the city', coord: [-111.9045, 40.81] },
  { id: 'idaho-falls', name: 'Idaho Falls', basis: 'Idaho Falls, Idaho, on I-15', coord: [-112.0339, 43.4917] },
  { id: 'swan-valley', name: 'Swan Valley', basis: 'Swan Valley, Idaho, on US-26 along the Snake River', coord: [-111.3305, 43.4566] },
  { id: 'alpine', name: 'Alpine', basis: 'Alpine, Wyoming — point 731 of feature 16, where the original road home goes on', coord: [-111.030075, 43.15918] },
];

/**
 * Pittsburgh: leave the truck near Monroeville, east of the city (the drive is cut there, see
 * data/legs.ts), walk into the city to the hotel and the Financial District, then straight across the Roberto
 * Clemente (Sixth Street) Bridge to the North Side, and on north to where the original walk
 * heads for the suburbs (its point ~8.2 km in).
 */
const PITTSBURGH_STOPS = [
  { id: 'truck', name: 'Leaving the truck', basis: 'by Monroeville, where the drive into Pittsburgh ends (point 2676 of feature 5)', coord: [-79.790291, 40.442253] },
  { id: 'hotel', name: 'Hotel Lobby', basis: 'Omni William Penn Hotel', coord: [-79.9966, 40.441] },
  { id: 'financial', name: 'Financial District', basis: 'PPG Place / Market Square', coord: [-80.0028, 40.4408] },
  // Both bridge waypoints lie ON the deck, so the route does not detour to reach them.
  { id: 'bridge-south', name: 'The bridge (south end)', basis: 'Roberto Clemente Bridge, south end of the deck', coord: [-80.00317, 40.44492] },
  { id: 'bridge-north', name: 'The bridge (north end)', basis: 'Roberto Clemente Bridge, north end of the deck', coord: [-80.0039, 40.44686] },
  { id: 'north-side', name: 'Out through the North Side', basis: 'the original walk heading north', coord: [-79.9982, 40.4573] },
];

const ROUTES = {
  boston: { stops: BOSTON_STOPS, file: 'public/server/info/boston-streets.geojson', title: 'Boston streets — Quarantine Zone to the Capitol' },
  hospital: { stops: HOSPITAL_STOPS, file: 'public/server/info/hospital-streets.geojson', title: "Salt Lake City streets — downtown to St. Mary's Hospital" },
  pittsburgh: { stops: PITTSBURGH_STOPS, file: 'public/server/info/pittsburgh-streets.geojson', title: 'Pittsburgh streets — from the truck across the Roberto Clemente Bridge' },
  escape: { stops: ESCAPE_STOPS, file: 'public/server/info/escape-streets.geojson', title: 'Salt Lake City streets — the drive away from the hospital', profile: 'driving' },
};
const which = process.argv[2];
const config = ROUTES[which];
if (!config) throw new Error(`Usage: npm run build:streets -- <${Object.keys(ROUTES).join('|')}>`);
const STOPS = config.stops;
const PROFILE = config.profile ?? 'walking';

const env = readFileSync('.env.local', 'utf8');
const token = /^VITE_MAPBOX_TOKEN=(pk\.[^\s]+)/m.exec(env)?.[1];
if (!token) throw new Error('VITE_MAPBOX_TOKEN not found in .env.local');

/**
 * Decodes Google's "encoded polyline" format, which Mapbox uses for `polyline6`
 * (6 = coordinates have 6 decimals). Each number is stored as the DIFFERENCE from the
 * previous one, zig-zag encoded and split into 5-bit chunks, each chunk + 63 written as one
 * character; a set 0x20 bit means "more chunks follow". Returns [lng, lat] pairs.
 */
function decodePolyline(encoded, precision) {
  const factor = 10 ** precision;
  const out = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1; // undo the zig-zag (sign) encoding
  };
  while (index < encoded.length) {
    lat += next();
    lng += next();
    out.push([lng / factor, lat / factor]); // the format stores lat first; GeoJSON wants lng first
  }
  return out;
}

/** Great-circle distance in metres (same formula as src/geo/polyline.ts). */
function haversine(a, b) {
  const R = 6371008.8;
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLng = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const line = [];
const stops = [];
let total = 0;
for (let i = 0; i < STOPS.length; i++) {
  const stop = STOPS[i];
  if (i === 0) {
    line.push(stop.coord);
    stops.push({ ...stop, distanceAlong: 0 });
    continue;
  }
  const from = STOPS[i - 1].coord.join(',');
  const to = stop.coord.join(',');
  // geometries=polyline6: full-detail GeoJSON output answered "NoRoute" for the ~13 km
  // hospital route (a server-side quirk), while the same route in the compact polyline6
  // encoding works, so we request that and decode it ourselves (decodePolyline below).
  const url = `https://api.mapbox.com/directions/v5/mapbox/${PROFILE}/${from};${to}?geometries=polyline6&overview=full&access_token=${token}`;
  // The API also occasionally answers "NoRoute" for a route it finds a moment later,
  // so retry a few times before giving up.
  let json;
  for (let attempt = 1; attempt <= 4; attempt++) {
    // The token is URL-restricted to the dev server, so say we are asking from there.
    json = await (await fetch(url, { headers: { Referer: 'http://localhost:5173/' } })).json();
    if (json.code === 'Ok') break;
    await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
  }
  if (json.code !== 'Ok') throw new Error(`Directions failed for ${stop.id}: ${json.code} ${json.message ?? ''}`);
  const coords = decodePolyline(json.routes[0].geometry, 6);
  // Start the piece exactly where the line currently ends (no gap), skip its first point.
  for (let k = 1; k < coords.length; k++) {
    total += haversine(line[line.length - 1], coords[k]);
    line.push(coords[k]);
  }
  stops.push({ ...stop, distanceAlong: Math.round(total) });
}

/**
 * Removes out-and-back spurs: Directions reaches a waypoint that is a little off its path by
 * walking to it and straight back, which leaves A → B → A in the line (the travellers would
 * step forward and back). Any point whose neighbours (nearly) coincide is such a turn-around:
 * drop it and the repeated point, and keep going until none are left.
 */
function removeSpurs(points) {
  const out = [...points];
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 1; i < out.length - 1; i++) {
      if (haversine(out[i - 1], out[i + 1]) < 4) {
        out.splice(i, 2); // the tip of the spur and the point that repeats its start
        changed = true;
        break;
      }
    }
  }
  return out;
}
const cleaned = removeSpurs(line);
if (cleaned.length !== line.length) {
  console.log(`removed ${line.length - cleaned.length} spur points`);
  line.splice(0, line.length, ...cleaned);
  // Re-measure the stops' distances along the cleaned line (each stop: its nearest line point).
  const along = [0];
  for (let k = 1; k < line.length; k++) along.push(along[k - 1] + haversine(line[k - 1], line[k]));
  total = along.at(-1);
  let from = 0;
  for (const s of stops) {
    let best = from;
    for (let k = from; k < line.length; k++) if (haversine(line[k], s.coord) < haversine(line[best], s.coord)) best = k;
    s.distanceAlong = Math.round(along[best]);
    from = best;
  }
}

const geojson = {
  type: 'FeatureCollection',
  generator: `scripts/build-street-routes.mjs (Mapbox Directions API, ${PROFILE})`,
  features: [
    { type: 'Feature', properties: { name: config.title, length: Math.round(total) }, geometry: { type: 'LineString', coordinates: line } },
    ...stops.map((s) => ({
      type: 'Feature',
      properties: { id: s.id, name: s.name, basis: s.basis, distanceAlong: s.distanceAlong },
      geometry: { type: 'Point', coordinates: s.coord },
    })),
  ],
};
writeFileSync(config.file, JSON.stringify(geojson, null, 1) + '\n');
console.log(`${which} route: ${line.length} points, ${(total / 1000).toFixed(2)} km → ${config.file}`);
for (const s of stops) console.log(`  ${String(s.distanceAlong).padStart(5)} m  ${s.name}`);
