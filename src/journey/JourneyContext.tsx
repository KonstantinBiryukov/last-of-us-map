/**
 * JourneyContext.tsx — hands the shared "runtime" objects to every component.
 *
 * The runtime is created ONCE (see useJourneyRuntime.ts):
 *   engine    – the playback engine (single source of truth for story position)
 *   loop      – the single requestAnimationFrame loop
 *   music     – the soundtrack player
 *   settings  – user preferences
 *   camera    – the map camera director (exists once the map has loaded)
 *
 * Components get them with small hooks such as `usePlayback()`, which also
 * subscribe to the relevant store so the component re-renders when (and only
 * when) that store changes.
 */
import { createContext, useContext, useSyncExternalStore } from 'react';
import type { PlaybackEngine, PlaybackSnapshot } from '../playback/engine';
import type { FrameLoop } from '../playback/frameLoop';
import type { MusicPlayer, MusicState } from '../audio/MusicPlayer';
import type { Settings, SettingsStore } from '../state/settings';
import type { CameraDirector, CameraMode } from '../map/camera';
import { Store } from '../state/store';

/** Holds the camera director once the map creates it (React components may render before that). */
export class CameraSlot extends Store<{ director: CameraDirector | null }> {
  constructor() {
    super({ director: null }); // no map yet
  }
  /** Called by MapView when the map is created (director) or destroyed (null). */
  setDirector(director: CameraDirector | null): void {
    this.set({ director });
  }
}

/** The shared objects every component may need. */
export interface JourneyRuntime {
  /** Single source of truth for the story position. */
  engine: PlaybackEngine;
  /** The one requestAnimationFrame loop. */
  loop: FrameLoop;
  /** The soundtrack player (independent from the story). */
  music: MusicPlayer;
  /** User preferences. */
  settings: SettingsStore;
  /** Holds the camera director once the map exists. */
  cameraSlot: CameraSlot;
  /** The OS "reduce motion" accessibility setting, read once at start-up. */
  reducedMotion: boolean;
}

/**
 * React "context": a way to hand a value to every component below a Provider
 * without passing it through each component's props.
 */
const JourneyContext = createContext<JourneyRuntime | null>(null);

/** Wrap the app in <JourneyProvider value={runtime}> to make the runtime available below. */
export const JourneyProvider = JourneyContext.Provider;

/** Returns the runtime; throws a clear error if used outside the provider (a programming mistake). */
export function useJourney(): JourneyRuntime {
  const runtime = useContext(JourneyContext);
  if (!runtime) throw new Error('useJourney must be used inside <JourneyProvider>');
  return runtime;
}

/** Slow-changing playback state (status, chapter, slide). */
export function usePlayback(): PlaybackSnapshot {
  const { engine } = useJourney();
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot);
}

/** Slow-changing music state (track, playing, volume…). */
export function useMusic(): MusicState {
  const { music } = useJourney();
  return useSyncExternalStore(music.subscribe, music.getSnapshot);
}

/** User preferences. */
export function useSettings(): Settings {
  const { settings } = useJourney();
  return useSyncExternalStore(settings.subscribe, settings.getSnapshot);
}

/** The camera director, or null while the map is still loading. */
export function useCameraDirector(): CameraDirector | null {
  const { cameraSlot } = useJourney();
  return useSyncExternalStore(cameraSlot.subscribe, cameraSlot.getSnapshot).director;
}

// Stand-ins used while there is no camera yet (hooks must always be called the same way).
const noopSubscribe = () => () => {};
const overviewMode = (): CameraMode => 'overview';

/** Current camera mode, for highlighting the Follow/Overview buttons. */
export function useCameraMode(): CameraMode {
  const director = useCameraDirector();
  return useSyncExternalStore(director?.subscribe ?? noopSubscribe, director?.getMode ?? overviewMode);
}
