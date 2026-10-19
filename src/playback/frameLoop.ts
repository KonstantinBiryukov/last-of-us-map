/**
 * frameLoop.ts — the ONE requestAnimationFrame loop of the application.
 *
 * Browsers call requestAnimationFrame callbacks right before painting the
 * screen (usually 60 times per second). Having several independent loops
 * wastes battery and lets animations drift apart, so the app has exactly one:
 *
 *   each frame:
 *     1. measure how much real time passed (dt) since the previous frame;
 *     2. advance the playback engine by dt (this moves the story clock);
 *     3. call every registered "frame task" (camera follow, scrubber, map
 *        repaint request, …) in registration order.
 *
 * Speed never depends on frame rate: everything uses dt (seconds), so a 30 fps
 * laptop and a 120 fps monitor show the story at exactly the same pace.
 *
 * When the tab is hidden, browsers stop calling requestAnimationFrame. When it
 * comes back, the first dt could be huge (minutes); the playback machine caps
 * one step at 0.25 s, so the story simply resumes where it was.
 */
import type { PlaybackEngine } from './engine';

/** A function called every frame. `dt` = seconds since the last frame; `now` = ms timestamp. */
export type FrameTask = (dt: number, now: number) => void;

export class FrameLoop {
  /** Functions to call every frame, in the order they were added. */
  private tasks: FrameTask[] = [];
  /** Id returned by requestAnimationFrame, needed to cancel the pending frame. */
  private handle = 0;
  /** Timestamp (ms) of the previous frame; -1 means "no previous frame yet, use dt = 0". */
  private last = -1;
  /** True between start() and stop(). */
  private running = false;
  private readonly engine: PlaybackEngine;
  /**
   * Called when the tab is hidden or shown. Resetting `last` makes the first
   * frame after returning count dt = 0 instead of "all the time the tab was hidden".
   * (An arrow function keeps `this` pointing at the loop when the browser calls it.)
   */
  private readonly onVisibility = () => {
    this.last = -1;
  };

  constructor(engine: PlaybackEngine) {
    this.engine = engine;
  }

  /**
   * Register a task; returns a function that unregisters it.
   * Removing creates a NEW array instead of editing the old one, so a frame that is
   * currently looping over the old array is not disturbed.
   */
  add(task: FrameTask): () => void {
    this.tasks.push(task);
    return () => {
      this.tasks = this.tasks.filter((t) => t !== task);
    };
  }

  /** Begin calling tasks every frame. Calling it twice does nothing (no duplicate loops). */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = -1;
    document.addEventListener('visibilitychange', this.onVisibility);
    this.handle = requestAnimationFrame(this.tick);
  }

  /** Stop the loop and remove the visibility listener (called on unmount — no leaked loops). */
  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.handle);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  /** Whether the loop is active (used by tests and debugging). */
  get isRunning(): boolean {
    return this.running;
  }

  /**
   * One frame. The browser passes `now`, a high-precision timestamp in milliseconds.
   * After running all tasks it asks for the next frame — that is what makes it a loop.
   */
  private tick = (now: number): void => {
    if (!this.running) return;
    const dt = this.last < 0 ? 0 : (now - this.last) / 1000; // ms → seconds
    this.last = now;
    this.engine.advance(dt);
    // Iterate over a stable copy in case a task unregisters itself mid-frame.
    const tasks = this.tasks;
    for (let i = 0; i < tasks.length; i++) {
      try {
        tasks[i]!(dt, now);
      } catch (error) {
        // One broken task must never stop the whole animation.
        console.error('Frame task failed', error);
      }
    }
    this.handle = requestAnimationFrame(this.tick);
  };
}
