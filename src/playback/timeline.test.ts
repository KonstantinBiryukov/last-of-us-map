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

  it('pace stays continuous where a leg is split between two chapters', () => {
    const spans = timeline.chapters.flatMap((c) => c.legSpans);
    for (let i = 1; i < spans.length; i++) {
      const a = spans[i - 1]!;
      const b = spans[i]!;
      if (a.legIndex !== b.legIndex) continue; // only split legs
      const speedA = (a.endDistance - a.startDistance) / (a.end - a.start);
      const speedB = (b.endDistance - b.startDistance) / (b.end - b.start);
      // Within 25 %: no visible lurch at the chapter boundary.
      expect(speedB / speedA).toBeGreaterThan(0.75);
      expect(speedB / speedA).toBeLessThan(1.33);
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

  it('locate is deterministic: the same time always gives the same frame', () => {
    expect(locate(timeline, 321.123)).toEqual(locate(timeline, 321.123));
  });

  it('chapter boundaries belong to the next chapter; the end belongs to the last', () => {
    expect(chapterIndexAt(timeline, timeline.chapters[3]!.start)).toBe(3);
    expect(chapterIndexAt(timeline, timeline.chapters[3]!.start - 0.001)).toBe(2);
    expect(chapterIndexAt(timeline, timeline.duration)).toBe(11);
  });
});
