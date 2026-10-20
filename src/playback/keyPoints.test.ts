import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../data/chapters';
import { KEY_POINTS, PROP_RADIUS } from '../data/keyPoints';
import { haversineMeters } from '../geo/polyline';
import { placeKeyPoints } from './keyPoints';
import { loadRealRoute } from './testUtils';
import { buildTimeline, isJumpKind } from './timeline';

describe('chapter key points', () => {
  const route = loadRealRoute();
  const timeline = buildTimeline(CHAPTERS, route);
  const placed = placeKeyPoints(timeline, CHAPTERS, route);

  it('every chapter has its key points (25 in all)', () => {
    expect(placed).toHaveLength(25);
    for (const chapter of CHAPTERS) expect(KEY_POINTS[chapter.number]?.length).toBeGreaterThan(0);
    expect(placed.filter((p) => p.chapterIndex === 9).map((p) => p.name)).toEqual(['The Giraffes']);
  });

  it('nobody walks through a prop: every travelled route point keeps clear of every footprint', () => {
    for (const p of placed.filter((p) => p.heading === undefined)) {
      // (Exact landmarks — the bridge they cross — are exempt.)
      // Close places only keep the route out of the footprint itself (see CLOSE PLACES).
      const clearance = p.close ? 0 : p.clearanceMetres;
      route.legs.forEach((leg) => {
        if (isJumpKind(leg.kind)) return;
        for (const c of leg.coordinates) {
          expect(haversineMeters(c, [p.lng, p.lat]), p.name).toBeGreaterThan(p.radiusMetres * 0.97 + clearance * 0.98);
        }
      });
    }
  });

  it('props never overlap each other', () => {
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i]!;
        const b = placed[j]!;
        expect(haversineMeters([a.lng, a.lat], [b.lng, b.lat]), `${a.name} / ${b.name}`).toBeGreaterThan(a.radiusMetres + b.radiusMetres);
      }
    }
  });

  it('within a chapter, props come along the route in the game order, on travelled parts', () => {
    for (const chapter of timeline.chapters) {
      const points = placed.filter((p) => p.chapterIndex === chapter.index);
      expect(points.map((p) => p.name)).toEqual((KEY_POINTS[CHAPTERS[chapter.index]!.number] ?? []).map((k) => k.name));
      points.forEach((point, i) => {
        const onTravelled = chapter.legSpans.some(
          (s) => !isJumpKind(s.kind) && point.distance >= s.startDistance && point.distance <= s.endDistance,
        );
        expect(onTravelled, point.name).toBe(true);
        expect(point.at).toBeGreaterThanOrEqual(0);
        expect(point.at).toBeLessThanOrEqual(1);
        if (i > 0) expect(point.distance, point.name).toBeGreaterThan(points[i - 1]!.distance);
      });
    }
  });

  it('close places stand right beside the route: the house where the drive starts, the State House, the hospital', () => {
    const find = (name: string) => placed.find((p) => p.name === name)!;
    const home = find('Hometown');
    const capitol = find('The Capitol Building');
    const hospital = find('The Hospital');
    for (const p of [home, capitol, hospital]) {
      expect(p.close, p.name).toBe(true);
      // Its edge is within a couple of steps of the route point the travellers pass.
      const passed = route.journey.pointAt(p.distance);
      expect(haversineMeters(passed, [p.lng, p.lat]) - p.radiusMetres, p.name).toBeLessThan(p.clearanceMetres * 2);
    }
    // The car leaves from the house; the trio reaches the State House as the Boston walk ends
    // (the trio part ends there); the journey ends at the hospital.
    expect(home.at).toBeLessThan(0.01);
    expect(Math.abs(capitol.distance - timeline.chapters[2]!.legSpans[0]!.endDistance)).toBeLessThan(400); // the last few seconds of the walk
    expect(hospital.at).toBeGreaterThan(0.99);
    // The State House stands near its real gold dome.
    expect(haversineMeters([capitol.lng, capitol.lat], capitol.coord)).toBeLessThan(150);
  });

  it('neighbouring props share one size (Pittsburgh), and the bridge stands exactly in place', () => {
    const size = (name: string) => placed.find((p) => p.name === name)!.metresPerModel;
    expect(size('Financial District')).toBeCloseTo(size('Hotel Lobby'), 6);
    expect(size('Escape the City')).toBeCloseTo(size('Hotel Lobby'), 6);
    // The bridge stands exactly on the Roberto Clemente Bridge, along its axis.
    const bridge = placed.find((p) => p.name === 'Escape the City')!;
    expect(haversineMeters([bridge.lng, bridge.lat], bridge.coord)).toBeLessThan(1);
    expect(bridge.heading).toBe(344);
    // Nothing stands in front of it (south, as the north-looking camera sees it).
    for (const p of placed.filter((p) => p !== bridge)) {
      const east = (p.lng - bridge.lng) * 111_320 * Math.cos((bridge.lat * Math.PI) / 180);
      const north = (p.lat - bridge.lat) * 111_320;
      const inFront = north < 0 && north > -5 * bridge.radiusMetres && Math.abs(east) < bridge.radiusMetres + p.radiusMetres;
      expect(inFront, p.name).toBe(false);
    }
    // All four — Joel, Ellie, Henry and Sam — are together for the WHOLE crossing (from where
    // they are first drawn on the deck), and already well before it, in the city.
    const partyAt = (d: number) =>
      [...timeline.chapters[4]!.legSpans.find((s) => d >= s.startDistance && d <= s.endDistance)!.party].sort();
    const four = ['ellie', 'henry', 'joel', 'sam'];
    expect(partyAt(bridge.crossing!.from - 2000)).toEqual(four);
    expect(partyAt(bridge.crossing!.from)).toEqual(four);
    expect(partyAt(bridge.distance)).toEqual(four);
    expect(partyAt(bridge.crossing!.to)).toEqual(four);
  });

  it('props stand near their real places (as near as the route allows)', () => {
    for (const p of placed) {
      // How close the chapter's route itself gets to the real place.
      const spans = timeline.chapters[p.chapterIndex]!.legSpans.filter((s) => !isJumpKind(s.kind));
      let routeGap = Infinity;
      for (const s of spans) {
        for (let d = s.startDistance; d <= s.endDistance; d += Math.max(20, (s.endDistance - s.startDistance) / 3000)) {
          routeGap = Math.min(routeGap, haversineMeters(route.journey.pointAt(d), p.coord));
        }
      }
      // Pushed out by its footprint and the travellers' room, plus at most one footprint nudge.
      const allowed = routeGap + 2 * (p.radiusMetres + p.clearanceMetres) + 2 * (PROP_RADIUS[p.prop] * p.metresPerModel + p.clearanceMetres);
      expect(haversineMeters([p.lng, p.lat], p.coord), p.name).toBeLessThan(allowed);
    }
  });
});
