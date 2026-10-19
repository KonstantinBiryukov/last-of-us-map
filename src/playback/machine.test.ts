import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, MAX_TICK_SECONDS, reduce, type PlaybackState } from './machine';

const D = 100; // story duration used in these tests

describe('playback state machine', () => {
  it('starts idle at time 0', () => {
    expect(INITIAL_STATE).toEqual({ status: 'idle', time: 0 });
  });

  it('play → playing, ticks advance time, pause freezes it', () => {
    let s = reduce(INITIAL_STATE, { type: 'play' }, D);
    expect(s.status).toBe('playing');
    s = reduce(s, { type: 'tick', dt: 0.05 }, D);
    s = reduce(s, { type: 'tick', dt: 0.05 }, D);
    expect(s.time).toBeCloseTo(0.1);
    s = reduce(s, { type: 'pause' }, D);
    expect(s).toEqual({ status: 'paused', time: s.time });
    const frozen = reduce(s, { type: 'tick', dt: 0.05 }, D);
    expect(frozen).toBe(s); // pausing really freezes the clock
  });

  it('resume continues from the paused position (no reset)', () => {
    const paused: PlaybackState = { status: 'paused', time: 42.5 };
    const resumed = reduce(paused, { type: 'play' }, D);
    expect(resumed).toEqual({ status: 'playing', time: 42.5 });
  });

  it('caps huge frame gaps so the story never leaps ahead', () => {
    const s = reduce({ status: 'playing', time: 10 }, { type: 'tick', dt: 30 }, D);
    expect(s.time).toBeCloseTo(10 + MAX_TICK_SECONDS);
  });

  it('ignores negative and NaN ticks safely', () => {
    const s0: PlaybackState = { status: 'playing', time: 10 };
    expect(reduce(s0, { type: 'tick', dt: -5 }, D).time).toBe(10);
    expect(reduce(s0, { type: 'seek', time: Number.NaN }, D).time).toBe(0);
  });

  it('finishes cleanly at the end and clamps time', () => {
    const s = reduce({ status: 'playing', time: 99.98 }, { type: 'tick', dt: 0.05 }, D);
    expect(s).toEqual({ status: 'finished', time: D });
  });

  it('play after finishing restarts from the beginning', () => {
    const s = reduce({ status: 'finished', time: D }, { type: 'play' }, D);
    expect(s).toEqual({ status: 'playing', time: 0 });
  });

  it('seek keeps playing when playing, and lands paused otherwise', () => {
    expect(reduce({ status: 'playing', time: 5 }, { type: 'seek', time: 50 }, D)).toEqual({
      status: 'playing',
      time: 50,
    });
    expect(reduce(INITIAL_STATE, { type: 'seek', time: 50 }, D)).toEqual({ status: 'paused', time: 50 });
    // Seeking back from "finished" makes the story usable again.
    expect(reduce({ status: 'finished', time: D }, { type: 'seek', time: 20 }, D)).toEqual({
      status: 'paused',
      time: 20,
    });
  });

  it('seek beyond the ends is clamped; seeking to the end finishes', () => {
    expect(reduce(INITIAL_STATE, { type: 'seek', time: -10 }, D).time).toBe(0);
    expect(reduce({ status: 'playing', time: 1 }, { type: 'seek', time: 500 }, D)).toEqual({
      status: 'finished',
      time: D,
    });
  });

  it('toggle switches between playing and paused', () => {
    const playing = reduce(INITIAL_STATE, { type: 'toggle' }, D);
    expect(playing.status).toBe('playing');
    expect(reduce(playing, { type: 'toggle' }, D).status).toBe('paused');
  });

  it('replay always restarts and plays', () => {
    expect(reduce({ status: 'paused', time: 70 }, { type: 'replay' }, D)).toEqual({
      status: 'playing',
      time: 0,
    });
  });
});
