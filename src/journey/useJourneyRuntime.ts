/**
 * useJourneyRuntime.ts — loads the route and builds the runtime objects once.
 *
 * Lifecycle (important for "no leaks"):
 *   mount   → download route → create engine, loop, music → start the loop
 *   unmount → stop the loop, dispose music and engine listeners
 * React's StrictMode (in development) mounts components twice on purpose to
 * catch missing cleanups; this hook survives that because every create has a
 * matching dispose.
 */
import { useEffect, useState } from 'react';
import { CHAPTERS } from '../data/chapters';
import { SOUNDTRACK } from '../data/soundtrack';
import { loadRoute } from '../geo/route';
import { PlaybackEngine } from '../playback/engine';
import { FrameLoop } from '../playback/frameLoop';
import { MusicPlayer } from '../audio/MusicPlayer';
import { SettingsStore, prefersReducedMotion } from '../state/settings';
import { CameraSlot, type JourneyRuntime } from './JourneyContext';
import { IS_DEV } from '../config/env';

/** What the app shows while starting: loading, ready (with the runtime) or an error message. */
export type RuntimeState =
  | { phase: 'loading' }
  | { phase: 'ready'; runtime: JourneyRuntime }
  | { phase: 'error'; message: string };

export function useJourneyRuntime(): RuntimeState {
  const [state, setState] = useState<RuntimeState>({ phase: 'loading' });

  useEffect(() => {
    // An AbortController lets the cleanup cancel the download if the component unmounts first.
    const abort = new AbortController();
    // Remembered here so the cleanup can dispose exactly what this effect created.
    let runtime: JourneyRuntime | null = null;

    loadRoute(abort.signal)
      .then((route) => {
        if (abort.signal.aborted) return;
        const engine = new PlaybackEngine(CHAPTERS, route);
        const loop = new FrameLoop(engine);
        runtime = {
          engine,
          loop,
          music: new MusicPlayer(SOUNDTRACK),
          settings: new SettingsStore(),
          cameraSlot: new CameraSlot(),
          reducedMotion: prefersReducedMotion(),
        };
        loop.start();
        // Development only: expose the runtime as `window.__journey` for debugging in the console.
        if (IS_DEV) (window as unknown as { __journey?: JourneyRuntime }).__journey = runtime;
        setState({ phase: 'ready', runtime });
      })
      .catch((error: unknown) => {
        if (abort.signal.aborted) return;
        const message = error instanceof Error ? error.message : 'Unknown error';
        setState({ phase: 'error', message });
      });

    return () => {
      abort.abort();
      if (runtime) {
        runtime.loop.stop();
        runtime.music.dispose();
        runtime.engine.dispose();
      }
    };
  }, []);

  return state;
}
