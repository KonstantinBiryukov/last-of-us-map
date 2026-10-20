/**
 * Data integrity tests: prove the migration preserved the original story data.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHAPTERS, TOTAL_SLIDES } from './chapters';
import { LOCATIONS, LOCATIONS_BY_ID, ORIGINAL_SALT_LAKE_CITY } from './locations';
import { LEG_META } from './legs';
import { SOUNDTRACK } from './soundtrack';
import { loadRealRoute } from '../playback/testUtils';
import { haversineMeters } from '../geo/polyline';
import { buildTimeline } from '../playback/timeline';

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
      // Salt Lake City's marker deliberately moved to the hospital (see locations.ts).
      if (location.id === 'salt-lake-city') expect(feature.geometry.coordinates).toEqual(ORIGINAL_SALT_LAKE_CITY);
      else expect(location.coordinates).toEqual(feature.geometry.coordinates);
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
        // A pause stands still at one point (from = to); every other part moves forward.
        if (part.pauseSeconds !== undefined) expect(to).toBe(from);
        else expect(to).toBeGreaterThan(from);
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

describe('each chapter travels only where its images are set', () => {
  const route = loadRealRoute();
  const timeline = buildTimeline(CHAPTERS, route);
  const place = (lng: number, lat: number) => [lng, lat] as const;
  const STATE_HOUSE = place(-71.0637, 42.3588); // Boston (the game's Capitol)
  const LINCOLN = place(-71.3042, 42.4259);
  const SLC = place(-111.891, 40.7608);
  const PITTSBURGH = place(-79.9959, 40.4406);

  /** Largest distance (km) from `centre` of any point travelled on DETAILED parts of a chapter. */
  function maxKm(chapterIndex: number, centre: readonly [number, number]): number {
    let max = 0;
    for (const span of timeline.chapters[chapterIndex]!.legSpans) {
      if (span.kind !== 'detailed') continue;
      for (let d = span.startDistance; d <= span.endDistance; d += 500) {
        max = Math.max(max, haversineMeters(route.journey.pointAt(d), centre) / 1000);
      }
    }
    return max;
  }

  it('Quarantine Zone stays in Boston, and the Outskirts trio walks Downtown → Museum → Capitol in Boston', () => {
    expect(maxKm(1, STATE_HOUSE)).toBeLessThan(2);
    const trio = timeline.chapters[2]!.legSpans[0]!;
    expect(trio.party).toContain('tess');
    for (let d = trio.startDistance; d <= trio.endDistance; d += 100) {
      expect(haversineMeters(route.journey.pointAt(d), STATE_HOUSE)).toBeLessThan(1500);
    }
  });

  it('the Boston chapter split points land on the game places of the street route', () => {
    const stops = (JSON.parse(readFileSync(join(publicDir, 'server/info/boston-streets.geojson'), 'utf8')) as {
      features: { geometry: { type: string; coordinates: [number, number] }; properties: { id: string } }[];
    }).features.filter((f) => f.geometry.type === 'Point');
    const at = (id: string) => stops.find((f) => f.properties.id === id)!.geometry.coordinates;
    const point = (span: { startDistance: number }) => route.journey.pointAt(span.startDistance);
    const [, , qzTrio] = timeline.chapters[1]!.legSpans; // after the time skip and Joel + Tess
    const [downtownTrio, afterCapitol] = timeline.chapters[2]!.legSpans;
    expect(haversineMeters(point(qzTrio!), at('fireflies'))).toBeLessThan(150); // Ellie joins at the Fireflies
    expect(haversineMeters(point(downtownTrio!), at('wall'))).toBeLessThan(150);
    expect(haversineMeters(point(afterCapitol!), at('capitol'))).toBeLessThan(150); // Tess stays behind
  });

  it("Bill's Town starts right outside Lincoln and stays there (no Connecticut or Pennsylvania)", () => {
    const first = timeline.chapters[3]!.legSpans[0]!;
    expect(haversineMeters(route.journey.pointAt(first.startDistance), LINCOLN) / 1000).toBeLessThan(3.1);
    expect(maxKm(3, LINCOLN)).toBeLessThan(20); // includes the first few km in Bill's truck
  });
  it('Pittsburgh starts with the drive and ends in Pittsburgh; The Suburbs stay near it', () => {
    expect(timeline.chapters[4]!.legSpans[0]!.mode).toBe('vehicle');
    expect(haversineMeters(route.journey.pointAt(timeline.chapters[4]!.legSpans.at(-1)!.endDistance), PITTSBURGH) / 1000).toBeLessThan(25);
    expect(maxKm(5, PITTSBURGH)).toBeLessThan(30);
  });
  it('Bus Depot and The Firefly Lab stay near Salt Lake City (no Colorado)', () => {
    expect(maxKm(9, SLC)).toBeLessThan(80);
    expect(maxKm(10, SLC)).toBeLessThan(16);
  });
  it('the journey through Salt Lake City ends at the hospital, where its marker is', () => {
    const hospital = LOCATIONS_BY_ID.get('salt-lake-city')!.coordinates;
    const end = route.journey.pointAt(timeline.chapters[10]!.legSpans.at(-1)!.endDistance);
    expect(haversineMeters(end, hospital)).toBeLessThan(200);
    // …and the drive away starts there, without heading back downtown first.
    const drive = timeline.chapters[11]!.legSpans[0]!;
    for (let d = drive.startDistance; d <= drive.startDistance + 5_000; d += 250) {
      expect(haversineMeters(route.journey.pointAt(d), hospital)).toBeLessThan(5_000);
    }
  });
});

