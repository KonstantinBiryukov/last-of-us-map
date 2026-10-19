/**
 * Data integrity tests: prove the migration preserved the original story data.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHAPTERS, TOTAL_SLIDES } from './chapters';
import { LOCATIONS, LOCATIONS_BY_ID } from './locations';
import { LEG_META } from './legs';
import { SOUNDTRACK } from './soundtrack';
import { loadRealRoute } from '../playback/testUtils';
import { haversineMeters } from '../geo/polyline';

const publicDir = join(process.cwd(), 'public');

interface MarkerFile {
  features: { geometry: { coordinates: [number, number] }; properties: { title: string; icon: string; photo: string } }[];
}

describe('story data', () => {
  it('keeps every original location with unchanged coordinates, icons and photos', () => {
    const original = JSON.parse(
      readFileSync(join(publicDir, 'server/info/markers.geojson'), 'utf8'),
    ) as MarkerFile;
    expect(LOCATIONS).toHaveLength(original.features.length);
    original.features.forEach((feature, i) => {
      const location = LOCATIONS[i]!;
      expect(location.title).toBe(feature.properties.title);
      expect(location.coordinates).toEqual(feature.geometry.coordinates);
      expect(location.icon).toBe(feature.properties.icon);
      expect(location.photo).toBe(feature.properties.photo);
    });
  });

  it('keeps all 134 original slides', () => {
    expect(TOTAL_SLIDES).toBe(134);
  });

  it('every referenced file exists on disk', () => {
    const files = [
      ...CHAPTERS.flatMap((c) => c.slides.map((s) => s.src)),
      ...LOCATIONS.flatMap((l) => [l.icon, l.photo]),
      ...SOUNDTRACK.map((t) => t.src),
    ];
    const missing = files.filter((f) => !existsSync(join(publicDir, f)));
    expect(missing).toEqual([]);
  });

  it('every chapter points to a real location, valid leg parts and at least one leg', () => {
    for (const chapter of CHAPTERS) {
      expect(LOCATIONS_BY_ID.has(chapter.locationId)).toBe(true);
      expect(chapter.legs.length).toBeGreaterThan(0);
      for (const part of chapter.legs) {
        expect(LEG_META[part.leg]).toBeDefined();
        const from = part.from ?? 0;
        const to = part.to ?? 1;
        expect(from).toBeGreaterThanOrEqual(0);
        expect(to).toBeLessThanOrEqual(1);
        expect(to).toBeGreaterThan(from);
      }
      expect(chapter.ambience.length).toBeGreaterThan(0);
    }
  });

  it('chapters are numbered 1…12 in order', () => {
    expect(CHAPTERS.map((c) => c.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('the route file loads into 17 measured legs', () => {
    const route = loadRealRoute();
    expect(route.legs).toHaveLength(17);
    expect(route.journey.length).toBeGreaterThan(1_000_000); // the trip is thousands of km
  });
});

describe('route corrections (the original GeoJSON is not perfect)', () => {
  const route = loadRealRoute();

  it('every leg starts exactly where the previous one ended — no hidden gaps', () => {
    for (let i = 1; i < route.legs.length; i++) {
      const previousEnd = route.legs[i - 1]!.coordinates.at(-1)!;
      const start = route.legs[i]!.coordinates[0]!;
      expect(haversineMeters(previousEnd, start)).toBeLessThan(1);
    }
  });

  it('jumps are smooth arcs (not straight 2-point lines) from end to start', () => {
    for (const leg of route.legs.filter((l) => l.kind !== 'detailed')) {
      expect(leg.coordinates.length).toBeGreaterThan(30);
    }
  });

  it('detailed legs have no suspicious straight hop (> 10 km) that would cut across terrain', () => {
    // Long straight interstate sections in Wyoming/Colorado legitimately have points
    // 2–6 km apart (route data simplifies straight roads); anything above 10 km would be a gap.
    route.legs.forEach((leg, i) => {
      if (leg.kind !== 'detailed') return;
      const line = route.legLines[i]!;
      for (let k = 1; k < line.count; k++) {
        expect(line.cumulative[k]! - line.cumulative[k - 1]!).toBeLessThan(10_000);
      }
    });
  });

  it('journey distances line up with each leg', () => {
    route.legs.forEach((_, i) => {
      if (i > 0) expect(route.legStart[i]).toBeCloseTo(route.legEnd[i - 1]!, 0);
      expect(route.legEnd[i]! - route.legStart[i]!).toBeCloseTo(route.legLines[i]!.length, -1);
    });
  });
});
