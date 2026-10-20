/**
 * testUtils.ts — helpers shared by the unit tests (not used by the app).
 *
 * Builds the REAL route from the original GeoJSON file (plus the generated street
 * routes) on disk, exactly as the app does, so tests check
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
    const read = (file: string) => JSON.parse(readFileSync(join(info, file), 'utf8')) as unknown;
    cached = buildRoute(read('test2.geojson'), LEG_META, {
      boston: read('boston-streets.geojson'),
      hospital: read('hospital-streets.geojson'),
      escape: read('escape-streets.geojson'),
      pittsburgh: read('pittsburgh-streets.geojson'),
    });
  }
  return cached;
}
