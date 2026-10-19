import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAPTERS } from '../data/chapters';
import { PlaybackEngine } from './engine';
import { FrameLoop } from './frameLoop';
import { loadRealRoute } from './testUtils';

/** A fake requestAnimationFrame we can step by hand, so tests control time exactly. */
let callbacks: Map<number, FrameRequestCallback>;
let nextId: number;

beforeEach(() => {
  callbacks = new Map();
  nextId = 1;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextId++;
    callbacks.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
});

afterEach(() => vi.unstubAllGlobals());

/** Runs every pending frame callback once with the given timestamp (ms). */
function step(now: number) {
  const pending = [...callbacks.entries()];
  callbacks.clear();
  for (const [, cb] of pending) cb(now);
}

describe('FrameLoop', () => {
  it('advances the engine by real elapsed time, independent of frame rate', () => {
    const engine = new PlaybackEngine(CHAPTERS, loadRealRoute());
    const loop = new FrameLoop(engine);
    engine.play();
    loop.start();
    // 30 fps for one second…
    for (let i = 0; i <= 30; i++) step(i * (1000 / 30));
    expect(engine.time).toBeCloseTo(1, 2);
    // …then 120 fps for one more second: same speed.
    const start = 1000;
    for (let i = 1; i <= 120; i++) step(start + i * (1000 / 120));
    expect(engine.time).toBeCloseTo(2, 2);
    loop.stop();
  });

  it('runs every task each frame, and a failing task does not stop the others', () => {
    const engine = new PlaybackEngine(CHAPTERS, loadRealRoute());
    const loop = new FrameLoop(engine);
    const good = vi.fn();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    loop.add(() => {
      throw new Error('boom');
    });
    loop.add(good);
    loop.start();
    step(0);
    step(16);
    expect(good).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalled();
    loop.stop();
  });

  it('stop() cancels the pending frame: no leaked animation loop', () => {
    const engine = new PlaybackEngine(CHAPTERS, loadRealRoute());
    const loop = new FrameLoop(engine);
    loop.start();
    loop.start(); // starting twice must not create two loops
    expect(callbacks.size).toBe(1);
    loop.stop();
    expect(callbacks.size).toBe(0);
    expect(loop.isRunning).toBe(false);
  });

  it('removing a task stops calling it', () => {
    const engine = new PlaybackEngine(CHAPTERS, loadRealRoute());
    const loop = new FrameLoop(engine);
    const task = vi.fn();
    const remove = loop.add(task);
    loop.start();
    step(0);
    remove();
    step(16);
    expect(task).toHaveBeenCalledTimes(1);
    loop.stop();
  });

  it('time spent in a hidden tab is not counted when the tab comes back', () => {
    const engine = new PlaybackEngine(CHAPTERS, loadRealRoute());
    const loop = new FrameLoop(engine);
    engine.play();
    loop.start();
    step(0);
    step(500);
    const before = engine.time;
    document.dispatchEvent(new Event('visibilitychange')); // tab hidden then shown
    step(60_500); // a minute later
    expect(engine.time).toBeCloseTo(before, 5); // first frame back only re-anchors the clock
    step(60_516);
    expect(engine.time).toBeGreaterThan(before);
    loop.stop();
  });
});
