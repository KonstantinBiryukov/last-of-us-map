import { describe, expect, it } from 'vitest';
import { CHAPTERS, TOTAL_SLIDES } from '../data/chapters';
import { buildTimeline, chapterIndexAt, completedLegCount, isJumpKind, locate } from './timeline';
import { loadRealRoute } from './testUtils';

const route = loadRealRoute();
const timeline = buildTimeline(CHAPTERS, route);

describe('timeline built from the real story data', () => {
  it('has one entry per chapter and lasts 5 s per slide (original pacing)', () => {
    expect(timeline.chapters).toHaveLength(12);
    expect(timeline.duration).toBeCloseTo(TOTAL_SLIDES * 5);
  });

  it('chapters are contiguous: each starts where the previous ends', () => {
    for (let i = 1; i < timeline.chapters.length; i++) {
      expect(timeline.chapters[i]!.start).toBeCloseTo(timeline.chapters[i - 1]!.end);
    }
  });

  it('every leg is travelled completely, in route order, with no slice missing or repeated', () => {
    const spans = timeline.chapters.flatMap((c) => c.legSpans);
    // Walk the spans: each must continue exactly where the previous one stopped.
    let leg = 0;
    let from = 0;
    for (const span of spans) {
      if (span.legIndex !== leg) {
        expect(from).toBeCloseTo(1); // previous leg was finished
        leg++;
        from = 0;
      }
      expect(span.legIndex).toBe(leg);
      expect(span.from).toBeCloseTo(from);
      from = span.to;
    }
    expect(leg).toBe(route.legs.length - 1);
    expect(from).toBeCloseTo(1);
  });

  it('travel covers each chapter from its first to its last second (no waiting, no hold)', () => {
    for (const chapter of timeline.chapters) {
      expect(chapter.legSpans[0]!.start).toBeCloseTo(chapter.start);
      expect(chapter.legSpans.at(-1)!.end).toBeCloseTo(chapter.end);
      for (let i = 1; i < chapter.legSpans.length; i++) {
        expect(chapter.legSpans[i]!.start).toBeCloseTo(chapter.legSpans[i - 1]!.end);
      }
    }
  });

  it('the travellers are ALWAYS moving: wherever you click, a second later they are elsewhere', () => {
    for (let t = 0; t < timeline.duration - 1; t += 0.5) {
      const a = locate(timeline, t);
      const b = locate(timeline, t + 1);
      expect(a.travelling).toBe(true);
      expect(b.distance).toBeGreaterThan(a.distance);
    }
  });

  it('route distance never goes backwards over the whole story', () => {
    let previous = -1;
    for (let t = 0; t <= timeline.duration; t += 0.25) {
      const frame = locate(timeline, t);
      expect(frame.distance).toBeGreaterThanOrEqual(previous - 1e-6);
      previous = frame.distance;
    }
  });

  it('the position always matches the leg progress (route reveal = traveller position)', () => {
    for (let t = 0; t <= timeline.duration; t += 0.5) {
      const f = locate(timeline, t);
      const start = route.legStart[f.legIndex]!;
      const end = route.legEnd[f.legIndex]!;
      expect(f.distance).toBeCloseTo(start + (end - start) * f.legProgress, 3);
    }
  });

  it('jumps and time skips take the fixed jump time', () => {
    for (const span of timeline.chapters.flatMap((c) => c.legSpans)) {
      if (isJumpKind(span.kind)) expect(span.end - span.start).toBeCloseTo(4.5);
    }
  });

  it('slides advance in the original order, 5 s each', () => {
    let globalIndex = -1;
    let lastKey = '';
    for (let t = 0; t < timeline.duration; t += 1) {
      const f = locate(timeline, t);
      const key = `${f.chapterIndex}:${f.slideIndex}`;
      if (key !== lastKey) {
        globalIndex++;
        lastKey = key;
      }
    }
    expect(globalIndex + 1).toBe(TOTAL_SLIDES);
  });

  it('completed legs never decrease, start at 0 and end at all legs', () => {
    expect(completedLegCount(timeline, 0)).toBe(0);
    expect(completedLegCount(timeline, timeline.duration)).toBe(route.legs.length);
    let previous = 0;
    for (let t = 0; t <= timeline.duration; t += 1) {
      const n = completedLegCount(timeline, t);
      expect(n).toBeGreaterThanOrEqual(previous);
      previous = n;
    }
  });

  it('a split leg is not "completed" until its last part ends', () => {
    // Leg 6 is shared by Chapter V and VI; at the end of Chapter V it is not complete yet.
    const endOfFive = timeline.chapters[4]!.end - 0.01;
    expect(completedLegCount(timeline, endOfFive)).toBe(6);
  });

  it('Lakeside Resort follows the game: ride with wounded Joel 40 %, Ellie alone 30 %, Joel alone 20 %, together 10 %', () => {
    const spans = timeline.chapters[8]!.legSpans; // Chapter IX
    const km = (sp: (typeof spans)[number]) => (sp.endDistance - sp.startDistance) / 1000;
    const total = spans.reduce((sum, sp) => sum + km(sp), 0);
    const share = (pick: (sp: (typeof spans)[number]) => boolean) => spans.filter(pick).reduce((a, sp) => a + km(sp), 0) / total;
    const alone = (who: string) => (sp: (typeof spans)[number]) => sp.party.length === 1 && sp.party[0] === who;
    expect(share((sp) => sp.wounded && sp.mode === 'horse')).toBeCloseTo(0.4, 2);
    expect(share(alone('ellie'))).toBeCloseTo(0.3, 2);
    expect(share(alone('joel'))).toBeCloseTo(0.2, 2);
    expect(spans.filter(alone('ellie')).every((sp) => sp.mode === 'walk')).toBe(true);
    expect(spans.filter(alone('joel')).every((sp) => sp.mode === 'walk')).toBe(true);
    // Order: ride → Ellie alone → Joel alone → together (the last 10 %).
    expect(spans[0]!.wounded).toBe(true);
    const last = spans.at(-1)!;
    expect(last.party).toEqual(['joel', 'ellie']);
    expect(km(last) / total).toBeCloseTo(0.1, 2);
    for (const span of timeline.chapters[9]!.legSpans) expect(span.party).toEqual(['joel', 'ellie']);
  });

  it('Tess is with them for most of The Outskirts (she dies near its end, at the Capitol)', () => {
    const c = timeline.chapters[2]!;
    const trio = c.legSpans.find((s) => s.party.includes('tess'))!;
    expect((trio.end - trio.start) / (c.end - c.start)).toBeGreaterThan(0.6);
  });

  it('Boston and Lincoln companions appear exactly where the game has them', () => {
    const parties = (chapter: number) => timeline.chapters[chapter]!.legSpans.filter((s) => s.kind === 'detailed').map((s) => s.party.join('+'));
    expect(parties(1)).toEqual(['joel+tess', 'joel+tess+ellie']); // QZ: Joel & Tess, then Ellie joins
    expect(parties(2)).toEqual(['joel+tess+ellie', 'joel+ellie']); // downtown with Tess, then without her
    expect(parties(3)).toEqual(['joel+ellie', 'joel+bill+ellie', 'joel+ellie']); // into Lincoln, with Bill, then the truck
    for (let c = 4; c < 12; c++) {
      for (const s of timeline.chapters[c]!.legSpans) {
        expect(s.party.includes('tess') || s.party.includes('bill')).toBe(false);
      }
    }
  });

  it("Bill's Town ends with Bill's truck (last 20 %) and the Epilogue walks only its last 20 %", () => {
    const bills = timeline.chapters[3]!;
    const truck = bills.legSpans.at(-1)!;
    expect(truck.mode).toBe('vehicle');
    expect((truck.end - truck.start) / (bills.end - bills.start)).toBeCloseTo(0.2, 5);
    const epilogue = timeline.chapters[11]!;
    const walk = epilogue.legSpans.at(-1)!;
    expect(walk.mode).toBe('walk');
    expect((walk.end - walk.start) / (epilogue.end - epilogue.start)).toBeCloseTo(0.2, 5);
    expect(epilogue.legSpans.slice(0, -1).every((s) => s.mode === 'vehicle')).toBe(true);
  });

  it('locate is deterministic: the same time always gives the same frame', () => {
    expect(locate(timeline, 321.123)).toEqual(locate(timeline, 321.123));
  });

  it('chapter boundaries belong to the next chapter; the end belongs to the last', () => {
    expect(chapterIndexAt(timeline, timeline.chapters[3]!.start)).toBe(3);
    expect(chapterIndexAt(timeline, timeline.chapters[3]!.start - 0.001)).toBe(2);
    expect(chapterIndexAt(timeline, timeline.duration)).toBe(11);
  });
});
