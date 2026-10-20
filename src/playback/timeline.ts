/**
 * timeline.ts — turns the story into a clock.
 *
 * The whole experience is ONE number: `time`, in seconds since the start of
 * the story. This file decides what every value of `time` means:
 *
 *   time ──► which chapter? which slide? which leg? how far along the route?
 *
 * Because that mapping is a pure function (same input → same output, no side
 * effects), seeking is deterministic: jumping to 03:12 always gives exactly the
 * same slide, map position and pose, no matter how you got there.
 * (Tests: timeline.test.ts.)
 *
 * How a chapter is laid out on the clock (example: Chapter II, 8 slides):
 *
 *   slides   |title|year | img | img | img | img | img | img |   ← 5 s per slide
 *   travel   |time skip |========= walking through Boston ========|
 *            ^chapter start (travel starts immediately)  chapter end^
 *
 *   • Travel fills the WHOLE chapter: from its first to its last second the
 *     travellers are moving. There is no waiting and no hold, so wherever you
 *     click on the timeline they are on their way somewhere.
 *   • Jumps and time skips (no detailed path) take a fixed 4.5 s, and a part may ask
 *     for a fixed share of the chapter (`timeShare`, e.g. the Epilogue's walk = 20 %).
 *   • The remaining time is shared by the detailed leg parts in proportion to
 *     their "travel effort": length ÷ relative speed of the travel mode. So in a
 *     chapter that has both a long truck drive and a short walk (Pittsburgh), the
 *     walk is not rushed through at truck speed. Chapters with many images and a
 *     short distance are naturally slower (more time to look).
 */
import type { Chapter, LegKind, PartCamera, TravelMode, Traveller } from '../data/types';
import type { Route } from '../geo/route';

/** The usual camera framing (no per-part override). */
const NO_CAMERA: PartCamera = {};

export interface TimelineConfig {
  /** Seconds each slide stays on screen (the original slideshow used 5 s). */
  slideSeconds: number;
  /** Fixed duration of a jump or time skip (no detailed path → the camera swoops over it). */
  jumpSeconds: number;
  /**
   * How fast each travel mode is relative to walking. Only RATIOS matter: within one
   * chapter, a truck part covers 5× more distance per second than a walking part.
   */
  modeSpeed: Readonly<Record<TravelMode, number>>;
}

export const DEFAULT_TIMELINE_CONFIG: TimelineConfig = {
  slideSeconds: 5,
  jumpSeconds: 4.5,
  modeSpeed: { walk: 1, horse: 2.5, vehicle: 5 },
};

/** Who travels when a leg part does not say otherwise. */
export const DEFAULT_PARTY: readonly Traveller[] = ['joel', 'ellie'];

/** When one leg part is travelled, both on the clock and on the journey line. */
export interface LegSpan {
  /** Index into Route.legs. */
  legIndex: number;
  /** Copied from the leg, for convenience. */
  kind: LegKind;
  /** Clock time (s) when this part starts / ends. */
  start: number;
  end: number;
  /** Which slice of the leg: 0 = leg start, 1 = leg end. */
  from: number;
  to: number;
  /** Who travels this slice, in walking order (e.g. Joel, Tess and Ellie in Boston). */
  party: readonly Traveller[];
  /** Joel lies wounded across the horse's back while Ellie rides. */
  wounded: boolean;
  /** Ellie carries her bow (data/types.ts LegPart). */
  bow: boolean;
  /** A pause: the travellers stand still for the whole span (data/types.ts `pauseSeconds`). */
  pause: boolean;
  /** During the pause Ellie shoots the rabbit (data/types.ts LegPart). */
  hunt: boolean;
  /** A snowstorm: wind-blown snow, and the walkers fight through it (data/types.ts LegPart). */
  blizzard: boolean;
  /** How they travel this slice (the part's override, else the leg's mode). */
  mode: TravelMode;
  /** Text for the story panel (the part's override, else the leg's note). */
  note: string;
  /** How the follow camera frames this part (data/types.ts PartCamera; {} = usual). */
  camera: PartCamera;
  /** Metres along the journey line where this part starts / ends. */
  startDistance: number;
  endDistance: number;
}

/** One chapter placed on the clock. */
export interface TimelineChapter {
  /** Position in the CHAPTERS array (0-based). */
  index: number;
  /** Clock time (s) when the chapter starts / ends. */
  start: number;
  end: number;
  /** Absolute start time of each slide. */
  slideStarts: readonly number[];
  /** How long each of its slides stays on screen (s): the usual 5 s, longer if a pause made the chapter longer. */
  slideSeconds: number;
  /** The leg parts travelled in this chapter, back to back, covering start → end. */
  legSpans: readonly LegSpan[];
}

export interface Timeline {
  chapters: readonly TimelineChapter[];
  /** Total length of the story in seconds. */
  duration: number;
  config: TimelineConfig;
}

/**
 * Everything the rest of the app needs to know about one instant.
 * A single object is reused by `locate(…, out)` so the 60 fps loop never
 * creates garbage (new objects every frame make the browser pause to clean up).
 */
export interface JourneyFrame {
  /** The clock time this frame describes (s). */
  time: number;
  /** Current chapter (0-based index into CHAPTERS). */
  chapterIndex: number;
  /** Slide index inside the chapter. */
  slideIndex: number;
  /** 0‥1 progress through the current slide (drives the slide progress bar and Ken Burns drift). */
  slideProgress: number;
  /** 0‥1 progress through the chapter. */
  chapterProgress: number;
  /** Index into Route.legs of the leg being travelled (-1 only after the very end). */
  legIndex: number;
  /** Index of the current span inside the chapter's `legSpans`. */
  spanIndex: number;
  /** 0‥1 progress along the WHOLE leg (not just this chapter's part). */
  legProgress: number;
  /** 0‥1 progress through the current part only. */
  partProgress: number;
  /** Where the travellers are, in metres along the journey line. */
  distance: number;
  /** True while a leg is being travelled (always, except at the very end of the story). */
  travelling: boolean;
}

/** Creates an empty frame (call once, then let `locate` fill it in every frame). */
export function createFrame(): JourneyFrame {
  return {
    time: 0,
    chapterIndex: 0,
    slideIndex: 0,
    slideProgress: 0,
    chapterProgress: 0,
    legIndex: 0,
    spanIndex: 0,
    legProgress: 0,
    partProgress: 0,
    distance: 0,
    travelling: true,
  };
}

/** True for legs with no detailed path (they get the fixed `jumpSeconds`). */
export function isJumpKind(kind: LegKind): boolean {
  return kind === 'jump' || kind === 'timeskip';
}

/** Builds the timeline for the given chapters and route. Pure and deterministic. */
export function buildTimeline(
  chapters: readonly Chapter[],
  route: Route,
  config: TimelineConfig = DEFAULT_TIMELINE_CONFIG,
): Timeline {
  const result: TimelineChapter[] = [];
  let clock = 0; // running total: where the next chapter starts

  chapters.forEach((chapter, index) => {
    if (chapter.legs.length === 0) throw new Error(`Chapter ${chapter.number} has no legs; travellers would stand still`);
    const start = clock;
    // The chapter's usual length (5 s per slide) is the `window` its travel is shared out in.
    // Pauses (`pauseSeconds`) come ON TOP of it: the chapter gets that much longer, and its
    // slides are spread evenly over the whole, longer chapter.
    const window = chapter.slides.length * config.slideSeconds;
    const pauseSeconds = chapter.legs.reduce((sum, part) => sum + (part.pauseSeconds ?? 0), 0);
    const end = start + window + pauseSeconds;
    const slideSeconds = (end - start) / chapter.slides.length;
    const slideStarts = chapter.slides.map((_, i) => start + i * slideSeconds);

    // Normalise the parts: fill in default from/to and look up each leg.
    const parts = chapter.legs.map((part) => {
      const leg = route.legs[part.leg];
      if (!leg) throw new Error(`Chapter ${chapter.number} references unknown leg ${part.leg}`);
      return {
        legIndex: part.leg,
        // A `hidden` part is played like a jump (fixed jump time, comet, camera pulled back).
        kind: part.hidden ? ('jump' as LegKind) : leg.kind,
        from: part.from ?? 0,
        to: part.to ?? 1,
        timeShare: part.timeShare,
        party: part.party ?? DEFAULT_PARTY,
        wounded: part.wounded ?? false,
        bow: part.bow ?? false,
        pauseSeconds: part.pauseSeconds,
        hunt: part.hunt ?? false,
        blizzard: part.blizzard ?? false,
        mode: part.mode ?? leg.mode,
        note: part.note ?? leg.note,
        camera: part.camera ?? NO_CAMERA,
      };
    });

    // Fixed time for jumps (shrunk if a short chapter could not otherwise fit them).
    const jumpCount = parts.filter((p) => isJumpKind(p.kind)).length;
    const jumpSeconds = Math.min(config.jumpSeconds, (window * 0.6) / Math.max(jumpCount, 1));
    // Parts with a fixed share of the chapter take it off the top, like jumps. (Pauses have
    // their own seconds, added to the chapter above, and take nothing from the window.)
    const fixedShareSeconds = parts.reduce((sum, p) => sum + (p.timeShare !== undefined ? window * p.timeShare : 0), 0);
    const flexibleSeconds = window - jumpCount * jumpSeconds - fixedShareSeconds;
    const sharesFlexible = (p: (typeof parts)[number]) => !isJumpKind(p.kind) && p.timeShare === undefined && p.pauseSeconds === undefined;

    // Detailed parts share the rest by effort = metres of the slice ÷ relative speed of its mode.
    const lengths = parts.map((p) =>
      sharesFlexible(p) ? (route.legLines[p.legIndex]!.length * (p.to - p.from)) / config.modeSpeed[p.mode] : 0,
    );
    const totalLength = lengths.reduce((a, b) => a + b, 0);
    const detailedCount = parts.filter(sharesFlexible).length;

    const legSpans: LegSpan[] = [];
    let t = start;
    parts.forEach((p, i) => {
      let seconds: number;
      if (p.pauseSeconds !== undefined) seconds = p.pauseSeconds;
      else if (isJumpKind(p.kind)) seconds = detailedCount === 0 && fixedShareSeconds === 0 ? window / parts.length : jumpSeconds;
      else if (p.timeShare !== undefined) seconds = window * p.timeShare;
      else seconds = totalLength > 0 ? (flexibleSeconds * lengths[i]!) / totalLength : flexibleSeconds / detailedCount;
      const legStart = route.legStart[p.legIndex]!;
      const legLength = route.legEnd[p.legIndex]! - legStart;
      legSpans.push({
        legIndex: p.legIndex,
        kind: p.kind,
        start: t,
        end: t + seconds,
        from: p.from,
        to: p.to,
        party: p.party,
        wounded: p.wounded,
        bow: p.bow,
        pause: p.pauseSeconds !== undefined,
        hunt: p.hunt,
        blizzard: p.blizzard,
        mode: p.mode,
        note: p.note,
        camera: p.camera,
        startDistance: legStart + legLength * p.from,
        endDistance: legStart + legLength * p.to,
      });
      t += seconds;
    });
    // Remove floating-point drift: the last part ends exactly when the chapter ends.
    legSpans[legSpans.length - 1]!.end = end;

    result.push({ index, start, end, slideStarts, slideSeconds, legSpans });
    clock = end;
  });

  return { chapters: result, duration: clock, config };
}

/**
 * Which chapter contains `time`? Binary search: look at the middle chapter,
 * then keep only the half that can contain `time`, until one chapter is left.
 * A chapter boundary belongs to the NEXT chapter; `time === duration` belongs to the last.
 */
export function chapterIndexAt(timeline: Timeline, time: number): number {
  const chapters = timeline.chapters;
  let lo = 0;
  let hi = chapters.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1; // `>> 1` = integer division by 2
    if (chapters[mid]!.start <= time) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * The heart of the system: describe the story at `time`.
 * Writes into `out` (to avoid allocations at 60 fps) and returns it.
 */
export function locate(timeline: Timeline, time: number, out: JourneyFrame = createFrame()): JourneyFrame {
  // Clamp to the valid range so callers can pass anything.
  const t = Math.min(Math.max(time, 0), timeline.duration);
  const chapterIndex = chapterIndexAt(timeline, t);
  const chapter = timeline.chapters[chapterIndex]!;
  const slideSeconds = chapter.slideSeconds;

  out.time = t;
  out.chapterIndex = chapterIndex;
  const slideCount = chapter.slideStarts.length;
  const slideFloat = (t - chapter.start) / slideSeconds; // e.g. 3.4 = 40 % into the 4th slide
  out.slideIndex = Math.min(slideCount - 1, Math.floor(slideFloat));
  out.slideProgress = Math.min(1, slideFloat - out.slideIndex);
  out.chapterProgress = (t - chapter.start) / (chapter.end - chapter.start);

  // Find the leg part containing t (a chapter has at most 3, so a simple loop is fastest).
  const spans = chapter.legSpans;
  let spanIndex = spans.length - 1;
  for (let i = 0; i < spans.length; i++) {
    if (t < spans[i]!.end) {
      spanIndex = i;
      break;
    }
  }
  const span = spans[spanIndex]!;
  const length = span.end - span.start;
  const partProgress = length > 0 ? Math.min(1, Math.max(0, (t - span.start) / length)) : 1;

  out.spanIndex = spanIndex;
  out.legIndex = span.legIndex;
  out.partProgress = partProgress;
  out.legProgress = span.from + (span.to - span.from) * partProgress;
  out.distance = span.startDistance + (span.endDistance - span.startDistance) * partProgress;
  // Only the very last instant of the story counts as "arrived".
  out.travelling = t < timeline.duration;
  return out;
}

/**
 * How many legs have been fully travelled at `time` (legs 0 … n-1 are complete).
 * A leg counts as complete when the part that reaches its end (`to === 1`) has finished.
 */
export function completedLegCount(timeline: Timeline, time: number): number {
  let count = 0;
  for (const chapter of timeline.chapters) {
    if (chapter.start > time) break;
    for (const span of chapter.legSpans) {
      if (span.end > time) return count;
      if (span.to >= 1) count = span.legIndex + 1;
    }
  }
  return count;
}

/** Start time of a chapter (used by next/previous/jump-to-location). Out-of-range indices are clamped. */
export function chapterStartTime(timeline: Timeline, chapterIndex: number): number {
  const clamped = Math.min(Math.max(chapterIndex, 0), timeline.chapters.length - 1);
  return timeline.chapters[clamped]!.start;
}

/** Start time of a specific slide. Out-of-range indices are clamped. */
export function slideStartTime(timeline: Timeline, chapterIndex: number, slideIndex: number): number {
  const chapter = timeline.chapters[Math.min(Math.max(chapterIndex, 0), timeline.chapters.length - 1)]!;
  const i = Math.min(Math.max(slideIndex, 0), chapter.slideStarts.length - 1);
  return chapter.slideStarts[i]!;
}
