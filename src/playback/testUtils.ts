/**
 * testUtils.ts — helpers shared by the unit tests (not used by the app).
 *
 * Builds the REAL route from the original GeoJSON file (plus the generated Boston
 * street route) on disk, exactly as the app does, so tests check
 * the actual story data rather than an invented stand-in.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRoute, type Route } from '../geo/route';
import { LEG_META } from '../data/legs';

let cached: Route | null = null;

export function loadRealRoute(): Route {
  if (!cached) {
    const info = join(process.cwd(), 'public', 'server', 'info');
    const route = JSON.parse(readFileSync(join(info, 'test2.geojson'), 'utf8')) as unknown;
    const boston = JSON.parse(readFileSync(join(info, 'boston-streets.geojson'), 'utf8')) as unknown;
    cached = buildRoute(route, LEG_META, boston);
  }
  return cached;
}
