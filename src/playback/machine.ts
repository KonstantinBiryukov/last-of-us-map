/**
 * machine.ts — the playback state machine, as a pure function.
 *
 * A "state machine" is a fancy name for a simple idea: the player is always in
 * exactly ONE of a few named states, and only specific events move it between
 * them. Writing it down explicitly prevents impossible situations such as
 * "paused but still moving".
 *
 *            play                     pause
 *   idle ───────────► playing ◄──────────────► paused
 *                        │      play/toggle      ▲
 *        time reaches end│                       │ seek (back into the story)
 *                        ▼                       │
 *                     finished ──────────────────┘
 *                        │ play / replay
 *                        └──────► playing (from 0)
 *
 *   • idle     – nothing has started yet (time = 0).
 *   • playing  – the clock moves forward with real time.
 *   • paused   – the clock is frozen; everything that depends on it freezes too.
 *   • finished – the clock reached the end of the story.
 *
 * `reduce(state, event)` never mutates its input and has no side effects, which
 * makes every transition trivial to unit test (machine.test.ts).
 */

export type PlaybackStatus = 'idle' | 'playing' | 'paused' | 'finished';

export interface PlaybackState {
  status: PlaybackStatus;
  /** Seconds since the beginning of the story. */
  time: number;
}

export type PlaybackEvent =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'toggle' }
  /** Real time passed; `dt` is in seconds. */
  | { type: 'tick'; dt: number }
  /** Jump to an absolute time. */
  | { type: 'seek'; time: number }
  /** Start again from the beginning and play. */
  | { type: 'replay' };

export const INITIAL_STATE: PlaybackState = { status: 'idle', time: 0 };

/**
 * The biggest step one tick may take. If the browser freezes for 3 seconds
 * (debugger, GPU hiccup), we do NOT want the story to leap 3 seconds ahead in
 * a single frame — we just continue smoothly. 0.25 s is large enough that a
 * slow device running at only 4–5 fps still plays the story at real speed.
 */
export const MAX_TICK_SECONDS = 0.25;

function clamp(time: number, duration: number): number {
  if (!Number.isFinite(time)) return 0;
  return Math.min(Math.max(time, 0), duration);
}

export function reduce(state: PlaybackState, event: PlaybackEvent, duration: number): PlaybackState {
  switch (event.type) {
    case 'play':
      if (state.status === 'playing') return state;
      // Pressing play at the very end starts over, like any media player.
      if (state.status === 'finished' || state.time >= duration) return { status: 'playing', time: 0 };
      return { status: 'playing', time: state.time };

    case 'pause':
      if (state.status !== 'playing') return state;
      return { status: 'paused', time: state.time };

    case 'toggle':
      return reduce(state, { type: state.status === 'playing' ? 'pause' : 'play' }, duration);

    case 'tick': {
      if (state.status !== 'playing') return state; // frozen unless playing
      const dt = Math.min(Math.max(event.dt, 0), MAX_TICK_SECONDS);
      const time = state.time + dt;
      if (time >= duration) return { status: 'finished', time: duration };
      return { status: 'playing', time };
    }

    case 'seek': {
      const time = clamp(event.time, duration);
      if (time >= duration) return { status: 'finished', time: duration };
      // Seeking keeps playing if we were playing; otherwise we land paused at that moment.
      if (state.status === 'playing') return { status: 'playing', time };
      return { status: 'paused', time };
    }

    case 'replay':
      return { status: 'playing', time: 0 };
  }
}
