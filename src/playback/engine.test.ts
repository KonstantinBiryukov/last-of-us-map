import { describe, expect, it, vi } from 'vitest';
import { CHAPTERS } from '../data/chapters';
import { PlaybackEngine } from './engine';
import { loadRealRoute } from './testUtils';

function makeEngine() {
  return new PlaybackEngine(CHAPTERS, loadRealRoute());
}

/** Simulates `seconds` of playback at 60 fps. */
function run(engine: PlaybackEngine, seconds: number) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) engine.advance(1 / 60);
}

describe('PlaybackEngine', () => {
  it('only moves while playing', () => {
    const e = makeEngine();
    run(e, 2);
    expect(e.time).toBe(0);
    e.play();
    run(e, 2);
    expect(e.time).toBeCloseTo(2, 1);
  });

  it('pause → resume continues from the same position', () => {
    const e = makeEngine();
    e.play();
    run(e, 3);
    e.pause();
    const pausedAt = e.time;
    const pausedDistance = e.frame.distance;
    run(e, 5);
    expect(e.time).toBe(pausedAt);
    expect(e.frame.distance).toBe(pausedDistance);
    e.play();
    run(e, 1);
    expect(e.time).toBeCloseTo(pausedAt + 1, 1);
  });

  it('pausing right before a chapter transition does not skip the transition', () => {
    const e = makeEngine();
    const boundary = e.timeline.chapters[1]!.start;
    e.seek(boundary - 0.01);
    expect(e.frame.chapterIndex).toBe(0);
    e.play();
    e.pause();
    run(e, 1);
    expect(e.frame.chapterIndex).toBe(0);
    e.play();
    run(e, 0.1);
    expect(e.frame.chapterIndex).toBe(1);
  });

  it('next / previous move by chapter; previous restarts after 3 s', () => {
    const e = makeEngine();
    e.next();
    expect(e.frame.chapterIndex).toBe(1);
    e.next();
    expect(e.frame.chapterIndex).toBe(2);
    e.previous(); // at the very start of chapter 3 → goes back to chapter 2
    expect(e.frame.chapterIndex).toBe(1);
    e.seek(e.timeline.chapters[1]!.start + 10);
    e.previous(); // 10 s into chapter 2 → restart chapter 2
    expect(e.frame.chapterIndex).toBe(1);
    expect(e.time).toBeCloseTo(e.timeline.chapters[1]!.start);
  });

  it('next on the last chapter finishes the story', () => {
    const e = makeEngine();
    e.goToChapter(11);
    e.play();
    e.next();
    expect(e.status).toBe('finished');
  });

  it('jumping to distant locations updates chapter, slide and position consistently', () => {
    const e = makeEngine();
    expect(e.goToLocation('salt-lake-city')).toBe(true);
    expect(CHAPTERS[e.frame.chapterIndex]!.locationId).toBe('salt-lake-city');
    expect(e.frame.slideIndex).toBe(0);
    const snapshot = e.getSnapshot();
    expect(snapshot.chapterIndex).toBe(e.frame.chapterIndex);
    expect(e.goToLocation('austin')).toBe(true);
    expect(e.frame.chapterIndex).toBe(0);
    expect(e.frame.distance).toBe(0);
  });

  it('selecting a location keeps the play/pause state', () => {
    const e = makeEngine();
    e.play();
    e.goToLocation('jackson');
    expect(e.status).toBe('playing');
    e.pause();
    e.goToLocation('boston');
    expect(e.status).toBe('paused');
  });

  it('seekInChapter scrubs inside the current chapter only', () => {
    const e = makeEngine();
    e.goToChapter(4);
    const c = e.timeline.chapters[4]!;
    e.seekInChapter(0.5);
    expect(e.time).toBeCloseTo((c.start + c.end) / 2);
    e.seekInChapter(2); // clamped
    expect(e.frame.chapterIndex).toBe(4);
  });

  it('slide navigation crosses chapter boundaries and updates the story position', () => {
    const e = makeEngine();
    e.goToSlide(0, CHAPTERS[0]!.slides.length - 1);
    e.nextSlide();
    expect(e.frame.chapterIndex).toBe(1);
    expect(e.frame.slideIndex).toBe(0);
    e.previousSlide();
    expect(e.frame.chapterIndex).toBe(0);
  });

  it('replay restarts from 0 and plays', () => {
    const e = makeEngine();
    e.seek(300);
    e.replay();
    expect(e.time).toBe(0);
    expect(e.status).toBe('playing');
  });

  it('notifies React only when slow-changing values change', () => {
    const e = makeEngine();
    const listener = vi.fn();
    e.subscribe(listener);
    e.play();
    expect(listener).toHaveBeenCalledTimes(1); // status changed
    run(e, 1); // same slide → no extra notifications
    expect(listener).toHaveBeenCalledTimes(1);
    run(e, 5); // crosses into the next slide
    expect(listener.mock.calls.length).toBeGreaterThan(1);
    expect(listener.mock.calls.length).toBeLessThan(10);
  });

  it('emits jump events for seeks so the camera can fly', () => {
    const e = makeEngine();
    const jumps: number[] = [];
    e.onJump((j) => jumps.push(j.toChapter));
    e.goToChapter(7);
    e.next();
    expect(jumps).toEqual([7, 8]);
  });

  it('dispose removes listeners', () => {
    const e = makeEngine();
    const listener = vi.fn();
    e.subscribe(listener);
    e.dispose();
    e.play();
    expect(listener).not.toHaveBeenCalled();
  });
});
