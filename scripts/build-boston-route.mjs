/**
 * build-boston-route.mjs — one-off data generator (run with `npm run build:boston`).
 *
 * WHY: the original route file's Boston section meanders back and forth within ~1 km
 * of downtown, so on the map Joel and Ellie looked like they were walking on the spot.
 * The game's Boston chapters move between distinct places, so this script builds a
 * walking route THROUGH those places, following real streets.
 *
 * HOW: it asks the Mapbox Directions API (walking profile) for the street path between
 * each pair of consecutive stops below, joins the pieces into one line, and writes
 *   public/server/info/boston-streets.geojson
 * containing that LineString plus one Point per stop with `distanceAlong` (metres from
 * the start of the line). The app then uses this line for the Boston part of leg 2
 * (see geo/route.ts) — the original file is not modified.
 *
 * The game's places are fictionalised; each stop is a real place chosen to match the
 * story (noted in `basis`). Your Mapbox token is read from .env.local.
 */
import { readFileSync, writeFileSync } from 'node:fs';

/** Stops in story order: Chapter II (Quarantine Zone) then Chapter III (The Outskirts). */
const STOPS = [
  { id: 'qz', name: 'Boston Quarantine Zone', basis: 'North End (the wiki: the QZ corresponds to the North End)', coord: [-71.0547, 42.3637] },
  { id: 'docks', name: "Robert's place at the docks", basis: 'Waterfront / Long Wharf', coord: [-71.051, 42.3604] },
  { id: 'fireflies', name: 'The Fireflies — Marlene hands over Ellie', basis: 'Government Center', coord: [-71.0592, 42.3597] },
  { id: 'wall', name: 'Beyond the wall', basis: 'Cambridge Street, the edge of the zone', coord: [-71.0625, 42.3608] },
  { id: 'downtown', name: 'Downtown', basis: 'Downtown Crossing', coord: [-71.0603, 42.3555] },
  { id: 'museum', name: 'The Museum', basis: 'Old State House (a museum; the game’s museum is fictional)', coord: [-71.0575, 42.3588] },
  { id: 'capitol', name: 'The Capitol Building', basis: 'Massachusetts State House', coord: [-71.0637, 42.3588] },
];

const env = readFileSync('.env.local', 'utf8');
const token = /^VITE_MAPBOX_TOKEN=(pk\.[^\s]+)/m.exec(env)?.[1];
if (!token) throw new Error('VITE_MAPBOX_TOKEN not found in .env.local');

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
  const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${from};${to}?geometries=geojson&overview=full&access_token=${token}`;
  const response = await fetch(url);
  const json = await response.json();
  if (json.code !== 'Ok') throw new Error(`Directions failed for ${stop.id}: ${json.code} ${json.message ?? ''}`);
  const coords = json.routes[0].geometry.coordinates;
  // Start the piece exactly where the line currently ends (no gap), skip its first point.
  for (let k = 1; k < coords.length; k++) {
    total += haversine(line[line.length - 1], coords[k]);
    line.push(coords[k]);
  }
  stops.push({ ...stop, distanceAlong: Math.round(total) });
}

const geojson = {
  type: 'FeatureCollection',
  generator: 'scripts/build-boston-route.mjs (Mapbox Directions API, walking)',
  features: [
    { type: 'Feature', properties: { name: 'Boston streets — Quarantine Zone to the Capitol', length: Math.round(total) }, geometry: { type: 'LineString', coordinates: line } },
    ...stops.map((s) => ({
      type: 'Feature',
      properties: { id: s.id, name: s.name, basis: s.basis, distanceAlong: s.distanceAlong },
      geometry: { type: 'Point', coordinates: s.coord },
    })),
  ],
};
writeFileSync('public/server/info/boston-streets.geojson', JSON.stringify(geojson, null, 1) + '\n');
console.log(`Boston route: ${line.length} points, ${(total / 1000).toFixed(2)} km`);
for (const s of stops) console.log(`  ${String(s.distanceAlong).padStart(5)} m  ${s.name}`);
