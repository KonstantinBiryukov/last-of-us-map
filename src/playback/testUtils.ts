/**
 * testUtils.ts — helpers shared by the unit tests (not used by the app).
 *
 * Builds the REAL route from the original GeoJSON file on disk, so tests check
 * the actual story data rather than an invented stand-in.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRoute, type Route } from '../geo/route';

let cached: Route | null = null;

export function loadRealRoute(): Route {
  if (!cached) {
    const file = join(process.cwd(), 'public', 'server', 'info', 'test2.geojson');
    cached = buildRoute(JSON.parse(readFileSync(file, 'utf8')) as unknown);
  }
  return cached;
}
