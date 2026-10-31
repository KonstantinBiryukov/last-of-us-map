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

  it('every chapter has its key points (30 in all)', () => {
    expect(placed).toHaveLength(30);
    for (const chapter of CHAPTERS) expect(KEY_POINTS[chapter.number]?.length).toBeGreaterThan(0);
    expect(placed.filter((p) => p.chapterIndex === 9).map((p) => p.name)).toEqual(['The Bus Depot', 'The Giraffes']);
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

  it('nobody walks through an arrival building: only the final approach crosses its footprint', () => {
    // The hospital (`arrive`) stands just beyond the end of the walk, so the last stretch of the
    // walk naturally runs onto its forecourt (its base). Nothing else of the journey may: once
    // a walk up 1500 East in Salt Lake City ran straight through the building. "Final approach"
    // = the last 1.3 footprint radii of route before the end (the base reaches 2.1 model metres
    // from the centre, the walk stops 0.9 in front of it: ~1.2 radii of base along the way in).
    for (const p of placed.filter((p) => p.arrive)) {
      for (let d = 0; d < p.distance - 1.3 * p.radiusMetres; d += 25) {
        const point = route.journey.pointAt(d);
        expect(haversineMeters(point, [p.lng, p.lat]), `${p.name}, ${Math.round(p.distance - d)} m before the end`).toBeGreaterThan(p.radiusMetres);
      }
      // …and the final approach is straight at its front: within 25° of the way it faces back.
      const approach = route.journey.bearingAt(p.distance - 175, 175);
      expect(Math.abs(((approach - p.bearing + 540) % 360) - 180), p.name).toBeLessThan(25);
    }
  });

  it("Salt Lake City: the rest of the walk keeps a traveller's height from every prop, and never turns back", () => {
    // The travellers are drawn at a fixed screen size: one model metre of them is `figure` real
    // metres at the camera's zoom for the part being walked (its speed ÷ 28 px/s per pixel, times
    // the part's `modelScale` — 1.5 after the giraffe). Apart from where they pass a prop (or walk
    // up to the hospital's door), the whole Salt Lake City walk keeps at least that from every
    // footprint — once a walk up 1500 East went through the hospital, and the turn onto 500 South
    // through the buses.
    const walk = [9, 10].flatMap((i) => timeline.chapters[i]!.legSpans.filter((s) => !isJumpKind(s.kind) && s.legIndex === 13 && s.endDistance - s.startDistance > 0));
    const city = walk.filter((s) => s.startDistance >= route.legStart[13]! + 0.85 * (route.legEnd[13]! - route.legStart[13]!));
    for (const p of placed.filter((p) => p.chapterIndex === 9 || p.chapterIndex === 10)) {
      for (const s of city) {
        const figure = ((81 * ((s.endDistance - s.startDistance) / (s.end - s.start) / 28)) / 1.85) * (s.camera.modelScale ?? 1);
        for (let d = s.startDistance; d <= s.endDistance; d += 20) {
          const own = p.arrive ? d > p.distance - 1.3 * p.radiusMetres : Math.abs(d - p.distance) < p.radiusMetres;
          if (own) continue;
          const gap = haversineMeters(route.journey.pointAt(d), [p.lng, p.lat]) - p.radiusMetres;
          expect(gap, `${p.name}, at ${route.journey.pointAt(d).map((v) => v.toFixed(4)).join(', ')}`).toBeGreaterThan(figure * 0.98);
        }
      }
    }
    // No U-turns (the travellers spun round on a hairpin by the hospital): over every 120 m of
    // the city walk the direction changes by less than 120° — street corners are 90°.
    const from = city[0]!.startDistance + 80;
    const to = city.at(-1)!.endDistance - 80;
    for (let d = from; d < to; d += 20) {
      const turn = Math.abs(((route.journey.bearingAt(d + 60, 60) - route.journey.bearingAt(d - 60, 60) + 540) % 360) - 180);
      expect(turn, `at ${route.journey.pointAt(d).map((v) => v.toFixed(4)).join(', ')}`).toBeLessThan(120);
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

  it('close places stand right beside the route (the house, the State House); the hospital awaits them at the end', () => {
    const find = (name: string) => placed.find((p) => p.name === name)!;
    const home = find('Hometown');
    const capitol = find('The Capitol Building');
    const hospital = find('The Hospital');
    for (const p of [home, capitol]) {
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
    // The hospital stands straight ahead of where the walk ends, facing the arriving travellers:
    // the end of the route is on its forecourt, a step in front of its front wall (0.7 model
    // metres in front of its centre).
    const walkEnd = route.journey.pointAt(hospital.distance);
    const fromCentre = haversineMeters(walkEnd, [hospital.lng, hospital.lat]) / hospital.metresPerModel;
    expect(fromCentre).toBeGreaterThan(0.7);
    expect(fromCentre).toBeLessThan(1.1);
    expect(((hospital.heading! - hospital.bearing + 360) % 360)).toBeCloseTo(180, 5);
    // Lakeside Resort's props keep the size and place they were tuned at (they once changed when
    // Fort Collins' pacing changed — see LAKESIDE_SCALE in data/keyPoints.ts).
    const hunt = find('The Hunt');
    expect(hunt.metresPerModel).toBeGreaterThan(1972 * 0.99);
    expect(hunt.metresPerModel).toBeLessThan(1972 * 1.01);
    expect(haversineMeters([hunt.lng, hunt.lat], [-105.4459, 40.0248])).toBeLessThan(50);
    expect(find('Cabin Resort').metresPerModel).toBeCloseTo(hunt.metresPerModel / 2, 0);
    // Salt Lake City: the school buses stand by Salt Lake Central Station, west of the walk up
    // 300 West (the station's side); the giraffe west of the walk north up 1100 East, in Liberty
    // Park (on their left, as when they walked north past it before).
    const buses = find('The Bus Depot');
    const station: [number, number] = [-111.908764, 40.762005]; // Salt Lake Central Station (Mapbox Search)
    expect(haversineMeters([buses.lng, buses.lat], station)).toBeLessThan(1_000);
    expect(buses.lng).toBeLessThan(route.journey.pointAt(buses.distance)[0]);
    const giraffe = find('The Giraffes');
    expect(giraffe.lng).toBeLessThan(route.journey.pointAt(giraffe.distance)[0]);
    // Each is as large next to the travellers as it was before the bus depot and the giraffe moved
    // into the city: metres per model metre ÷ the walking travellers' (81 px tall, 1.85 model
    // metres, at the follow camera's zoom for the walk past it — its speed ÷ 28 px/s per pixel):
    // buses 0.69, giraffe 1.15, hospital 1.61 × 1.5 (see SLC_BUSES, SLC_HOSPITAL in
    // data/keyPoints.ts — the travellers walking up to it are drawn 1.5× larger, too).
    const travellersAt = (p: typeof buses) => {
      const span = timeline.chapters[p.chapterIndex]!.legSpans.find((s) => !s.pause && p.distance >= s.startDistance && p.distance <= s.endDistance)!;
      return (81 * ((span.endDistance - span.startDistance) / (span.end - span.start) / 28)) / 1.85;
    };
    expect(buses.metresPerModel / travellersAt(buses)).toBeCloseTo(0.69, 1);
    expect(giraffe.metresPerModel / travellersAt(giraffe)).toBeCloseTo(1.15, 1);
    expect(hospital.metresPerModel / travellersAt(hospital)).toBeCloseTo(1.61 * 1.5, 1);
    // Jackson's props keep the size they were tuned at (they once changed when Salt Lake City's
    // pacing changed — see JACKSON_SCALE in data/keyPoints.ts).
    expect(find('Hydroelectric Dam').radiusMetres).toBeCloseTo(31_390, -1);
    expect(find('Ranch House').radiusMetres).toBeCloseTo(9_777, -1);
    expect(find('Jackson').radiusMetres).toBeCloseTo(1_504, -1);
    // The State House stands near its real gold dome.
    expect(haversineMeters([capitol.lng, capitol.lat], capitol.coord)).toBeLessThan(150);
  });

  it('Ellie pets the giraffe right where the walk passes it, while the giraffe slide is shown', () => {
    const chapter = timeline.chapters[9]!;
    const giraffe = placed.find((p) => p.name === 'The Giraffes')!;
    const pet = chapter.legSpans.find((s) => s.pet)!;
    // They stop where the walk passes the giraffe (within a few metres), on a straight stretch:
    // the walk's direction there is the same 300 m before and after (a bend left it ahead of her).
    expect(Math.abs(pet.startDistance - giraffe.distance)).toBeLessThan(30);
    const before = route.journey.bearingAt(pet.startDistance - 300, 100);
    const after = route.journey.bearingAt(pet.startDistance + 300, 100);
    expect(Math.abs(((after - before + 540) % 360) - 180)).toBeLessThan(10);
    // The giraffe slide (img_6_2) comes up just after they stop and is over just before they walk on.
    const slide = CHAPTERS[9]!.slides.findIndex((s) => s.src.endsWith('img_6_2.png'));
    const slideStart = chapter.slideStarts[slide]!;
    expect(slideStart).toBeGreaterThanOrEqual(pet.start);
    expect(slideStart - pet.start).toBeLessThan(0.5);
    expect(slideStart + chapter.slideSeconds).toBeLessThanOrEqual(pet.end);
    // In the city the viewer cannot zoom out, and at the giraffe not in either (data/chapters.ts).
    for (const span of chapter.legSpans.filter((s) => s.startDistance >= route.legStart[13]! + 0.78 * (route.legEnd[13]! - route.legStart[13]!))) {
      expect(span.camera.zoomOut).toBe(0);
    }
    expect(pet.camera.zoomIn).toBe(0);
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
