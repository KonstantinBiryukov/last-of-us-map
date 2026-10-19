/**
 * engine.ts — the ONE authoritative source of "where are we in the story".
 *
 * Everything that changes over the journey — slideshow, map camera, route
 * reveal, 3D characters, timeline scrubber — reads from this engine. Nothing
 * else keeps its own copy of the story position, so nothing can drift out of
 * sync.
 *
 * Two speeds of information:
 *   1. FAST (every frame, ~60×/s): `engine.frame` — exact time, route distance,
 *      leg progress. Read directly by Three.js, the map and the scrubber DOM.
 *      This NEVER triggers React renders (that would be far too slow).
 *   2. SLOW (only when something meaningful changes): `engine.getSnapshot()` —
 *      status, chapter, slide, leg. React subscribes to it through
 *      `useSyncExternalStore`, so components re-render only on those changes
 *      (e.g. a new slide every 5 s), never every frame.
 *
 * The engine does not own a requestAnimationFrame loop itself; the single
 * FrameLoop (frameLoop.ts) calls `advance(dt)` once per frame. That keeps the
 * engine fully testable: tests call `advance` with fake time steps.
 *
 * Every command (play, seek, next…) goes through `dispatch`, which runs the
 * pure state machine (machine.ts) and then recomputes `frame` with `locate`
 * (timeline.ts). So there is exactly one code path that changes the story.
 */
import type { Chapter, LocationId } from '../data/types';
import {
  buildTimeline,
  chapterStartTime,
  createFrame,
  locate,
  slideStartTime,
  type JourneyFrame,
  type Timeline,
  type TimelineConfig,
} from './timeline';
import { INITIAL_STATE, reduce, type PlaybackEvent, type PlaybackState, type PlaybackStatus } from './machine';
import type { Route } from '../geo/route';

/** The slowly-changing part of the state that React cares about. */
export interface PlaybackSnapshot {
  /** idle / playing / paused / finished (see machine.ts). */
  status: PlaybackStatus;
  /** Current chapter (0-based). */
  chapterIndex: number;
  /** Current slide inside that chapter (0-based). */
  slideIndex: number;
  /** Leg being travelled (index into route.legs). */
  legIndex: number;
}

/** Fired when the story position changes discontinuously (seek/jump), so the camera can fly there. */
export interface JumpEvent {
  /** Chapter before the jump. */
  fromChapter: number;
  /** Chapter after the jump. */
  toChapter: number;
  /** Increments with every jump; handy for effects that must react to each one. */
  id: number;
}

/** A function with no arguments called when the snapshot changes. */
type Listener = () => void;
/** A function called with the details of a jump. */
type JumpListener = (event: JumpEvent) => void;

/** If you press "previous" later than this (seconds) into a chapter, it restarts the chapter instead. */
const PREVIOUS_RESTART_THRESHOLD_S = 3;

export class PlaybackEngine {
  /** When each chapter, slide and leg happens on the clock (built once, never changes). */
  readonly timeline: Timeline;
  /** The story data (from data/chapters.ts). */
  readonly chapters: readonly Chapter[];
  /** The measured, corrected route (from geo/route.ts). */
  readonly route: Route;

  /**
   * Live, per-frame description of the story. It is ONE object that is updated
   * in place (to avoid creating garbage 60 times a second) — so read its values
   * when you need them; do not keep a copy and expect it to stay the same.
   */
  readonly frame: JourneyFrame = createFrame();

  /** The state machine's current state: status + time. Only `dispatch` changes it. */
  private state: PlaybackState = INITIAL_STATE;
  /** The object React reads. Replaced (never mutated) when a slow value changes. */
  private snapshot: PlaybackSnapshot;
  /** React components subscribed to snapshot changes. A Set ignores duplicates. */
  private listeners = new Set<Listener>();
  /** Subscribers to jump events (the camera director). */
  private jumpListeners = new Set<JumpListener>();
  /** Running count used to give each jump event a unique id. */
  private jumpCounter = 0;

  /**
   * @param chapters story data
   * @param route    loaded route
   * @param config   optional timing overrides (tests use this)
   */
  constructor(chapters: readonly Chapter[], route: Route, config?: TimelineConfig) {
    this.chapters = chapters;
    this.route = route;
    this.timeline = buildTimeline(chapters, route, config);
    locate(this.timeline, 0, this.frame); // describe second 0 before anything plays
    this.snapshot = this.makeSnapshot();
  }

  // ───────────────────────── reading ─────────────────────────

  /** Current story time in seconds. (`get` makes it read like a property: `engine.time`.) */
  get time(): number {
    return this.state.time;
  }

  /** Total story length in seconds. */
  get duration(): number {
    return this.timeline.duration;
  }

  /** Current status (idle / playing / paused / finished). */
  get status(): PlaybackStatus {
    return this.state.status;
  }

  /**
   * For React's useSyncExternalStore: must return the SAME object until something changes
   * (React compares with ===; a new object every call would cause endless re-renders).
   * Written as an arrow-function property so it can be passed around without losing `this`.
   */
  getSnapshot = (): PlaybackSnapshot => this.snapshot;

  /** For React's useSyncExternalStore. Returns an unsubscribe function. */
  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Listen for discontinuous jumps (seek, next, previous, select location). Returns an unsubscribe function. */
  onJump(listener: JumpListener): () => void {
    this.jumpListeners.add(listener);
    return () => this.jumpListeners.delete(listener);
  }

  // ───────────────────────── the clock ─────────────────────────

  /** Called once per animation frame by the FrameLoop with the elapsed seconds. */
  advance(dt: number): void {
    if (this.state.status !== 'playing') return; // paused/idle/finished: nothing moves (cheap early exit)
    this.dispatch({ type: 'tick', dt });
  }

  // ───────────────────────── commands ─────────────────────────

  /** Start or resume. Pressing play at the end restarts from the beginning (and counts as a jump). */
  play(): void {
    const wasFinished = this.state.status === 'finished';
    const from = this.frame.chapterIndex;
    this.dispatch({ type: 'play' });
    if (wasFinished) this.emitJump(from); // restarting from the end is a jump: the camera flies back
  }

  /** Freeze the story where it is. */
  pause(): void {
    this.dispatch({ type: 'pause' });
  }

  /** Play if paused, pause if playing (the Space key and the big play button). */
  toggle(): void {
    if (this.state.status === 'playing') this.pause();
    else this.play();
  }

  /**
   * Jump to an absolute time (keeps playing if it was playing).
   * While the user is dragging the timeline, pass `emitJump = false` so the
   * camera does not start a new flight on every pixel; the final position is
   * committed with a normal seek when the drag ends.
   */
  seek(time: number, emitJump = true): void {
    const from = this.frame.chapterIndex;
    this.dispatch({ type: 'seek', time });
    if (emitJump) this.emitJump(from);
  }

  /** Seek to a fraction (0‥1) of the current chapter. */
  seekInChapter(fraction: number): void {
    const chapter = this.timeline.chapters[this.frame.chapterIndex]!;
    // 0.9999 instead of 1: exactly 1 would be the first instant of the NEXT chapter.
    const f = Math.min(Math.max(fraction, 0), 0.9999);
    this.seek(chapter.start + (chapter.end - chapter.start) * f);
  }

  /** Jump to the first second of a chapter. */
  goToChapter(chapterIndex: number): void {
    this.seek(chapterStartTime(this.timeline, chapterIndex));
  }

  /** Jump to the first chapter that takes place at a location. Returns false if none does. */
  goToLocation(locationId: LocationId): boolean {
    const index = this.chapters.findIndex((c) => c.locationId === locationId);
    if (index < 0) return false;
    // If we are already inside a chapter at this location, restart it rather than going back further
    // (e.g. clicking Boston during Chapter III restarts III instead of jumping back to II).
    const current = this.chapters[this.frame.chapterIndex];
    this.goToChapter(current?.locationId === locationId ? this.frame.chapterIndex : index);
    return true;
  }

  /** Next chapter; on the last chapter it jumps to the end (finished). */
  next(): void {
    const index = this.frame.chapterIndex;
    if (index >= this.chapters.length - 1) this.seek(this.duration);
    else this.goToChapter(index + 1);
  }

  /** Previous chapter — or restart the current one if we are more than 3 s into it (like music players). */
  previous(): void {
    const index = this.frame.chapterIndex;
    const chapterStart = this.timeline.chapters[index]!.start;
    if (this.time - chapterStart > PREVIOUS_RESTART_THRESHOLD_S || index === 0) this.goToChapter(index);
    else this.goToChapter(index - 1);
  }

  /** Back to the start of the current chapter. */
  restartChapter(): void {
    this.goToChapter(this.frame.chapterIndex);
  }

  /** Back to the very beginning, playing. */
  replay(): void {
    const from = this.frame.chapterIndex;
    this.dispatch({ type: 'replay' });
    this.emitJump(from);
  }

  /** Jump to a specific image of a chapter (the slideshow dots use this). */
  goToSlide(chapterIndex: number, slideIndex: number): void {
    this.seek(slideStartTime(this.timeline, chapterIndex, slideIndex));
  }

  /** Next image, crossing into the next chapter after the last one. */
  nextSlide(): void {
    const { chapterIndex, slideIndex } = this.frame;
    const count = this.chapters[chapterIndex]!.slides.length;
    if (slideIndex < count - 1) this.goToSlide(chapterIndex, slideIndex + 1);
    else if (chapterIndex < this.chapters.length - 1) this.goToSlide(chapterIndex + 1, 0);
  }

  /** Previous image, crossing back into the previous chapter's last image. */
  previousSlide(): void {
    const { chapterIndex, slideIndex } = this.frame;
    if (slideIndex > 0) this.goToSlide(chapterIndex, slideIndex - 1);
    else if (chapterIndex > 0) {
      const prevCount = this.chapters[chapterIndex - 1]!.slides.length;
      this.goToSlide(chapterIndex - 1, prevCount - 1);
    }
  }

  /** Drop all listeners (called when the journey view unmounts, so nothing keeps it alive). */
  dispose(): void {
    this.listeners.clear();
    this.jumpListeners.clear();
  }

  // ───────────────────────── internals ─────────────────────────

  /**
   * The single place where the story changes:
   *   1. ask the pure state machine for the next state;
   *   2. if it did not change (same object back), do nothing;
   *   3. otherwise recompute the per-frame description and maybe notify React.
   */
  private dispatch(event: PlaybackEvent): void {
    const next = reduce(this.state, event, this.timeline.duration);
    if (next === this.state) return;
    this.state = next;
    locate(this.timeline, next.time, this.frame);
    this.refreshSnapshot();
  }

  /** Builds a fresh snapshot object from the current state and frame. */
  private makeSnapshot(): PlaybackSnapshot {
    return {
      status: this.state.status,
      chapterIndex: this.frame.chapterIndex,
      slideIndex: this.frame.slideIndex,
      legIndex: this.frame.legIndex,
    };
  }

  /** Only create a new snapshot (and notify React) if a slow-changing value differs. */
  private refreshSnapshot(): void {
    const s = this.snapshot;
    const f = this.frame;
    if (
      s.status === this.state.status &&
      s.chapterIndex === f.chapterIndex &&
      s.slideIndex === f.slideIndex &&
      s.legIndex === f.legIndex
    ) {
      return; // nothing React shows has changed → no re-render
    }
    this.snapshot = this.makeSnapshot();
    for (const listener of this.listeners) listener();
  }

  /** Tells jump listeners (the camera) that the story position changed abruptly. */
  private emitJump(fromChapter: number): void {
    const event: JumpEvent = { fromChapter, toChapter: this.frame.chapterIndex, id: ++this.jumpCounter };
    for (const listener of this.jumpListeners) listener(event);
  }
}
