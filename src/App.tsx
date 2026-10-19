/**
 * App.tsx — the top of the component tree.
 *
 *   ┌ useJourneyRuntime: downloads the route, creates engine/loop/music once
 *   ├ JourneyScreen:     the map, story panel and player (once ready)
 *   ├ Intro:             the title screen at #/ (the map loads behind it)
 *   └ About:             credits overlay at #/about
 */
import { useCallback, useEffect, useRef } from 'react';
import { JourneyProvider } from './journey/JourneyContext';
import { useJourneyRuntime } from './journey/useJourneyRuntime';
import { JourneyScreen } from './ui/JourneyScreen';
import { Intro } from './ui/Intro';
import { About } from './ui/About';
import { useHashRoute } from './ui/useHashRoute';
import styles from './App.module.css';

export function App() {
  /** Current screen from the URL, and a function to change it. */
  const [route, navigate] = useHashRoute();
  /** Loading → ready (engine, loop, music…) or error. */
  const state = useJourneyRuntime();
  const showIntro = route.name === 'intro';
  const showAbout = route.name === 'about';

  // Remember where the user was before opening About, to return there on close.
  const lastRoute = useRef('/');
  useEffect(() => {
    if (route.name !== 'about') lastRoute.current = window.location.hash.replace(/^#/, '') || '/';
  }, [route]);

  /**
   * "Begin" / "Continue the journey". This runs inside a real click, which is
   * what browsers require before they allow sound — so the music can start too.
   */
  const begin = useCallback(() => {
    if (state.phase !== 'ready') return;
    const { engine, music } = state.runtime;
    if (engine.status === 'finished') engine.replay();
    else engine.play(); // resumes exactly where the user left off
    if (music.getSnapshot().status !== 'playing') void music.play();
    state.runtime.cameraSlot.getSnapshot().director?.follow(); // undefined while the map is still loading
    navigate('/path');
  }, [state, navigate]);

  /** "Start over": back to the first second of the story, playing. */
  const startOver = useCallback(() => {
    if (state.phase !== 'ready') return;
    const { engine, music } = state.runtime;
    engine.replay();
    if (music.getSnapshot().status !== 'playing') void music.play();
    navigate('/path');
  }, [state, navigate]);

  // Has the user already watched part of the story? (Read on every render; App re-renders
  // whenever the URL changes, e.g. when the user comes back to the main menu.)
  const inProgress =
    state.phase === 'ready' && state.runtime.engine.time > 0 && state.runtime.engine.status !== 'finished';

  return (
    <>
      {state.phase === 'ready' && (
        <JourneyProvider value={state.runtime}>
          <JourneyScreen
            route={route}
            covered={showIntro || showAbout}
            onAbout={() => navigate('/about')}
            onMenu={() => navigate('/')}
            navigate={navigate}
          />
        </JourneyProvider>
      )}

      {state.phase === 'loading' && !showIntro && (
        <div className={styles.loading} role="status">
          <span className={styles.firefly} aria-hidden="true" />
          Loading the journey…
        </div>
      )}

      {state.phase === 'error' && (
        <div className={styles.error} role="alert">
          <h1>The journey could not be loaded</h1>
          <p>{state.message}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      )}

      {showIntro && (
        <Intro
          ready={state.phase === 'ready'}
          inProgress={inProgress}
          onBegin={begin}
          onStartOver={startOver}
          onExplore={() => navigate('/map')}
          onAbout={() => navigate('/about')}
        />
      )}
      {showAbout && <About onClose={() => navigate(lastRoute.current === '/about' ? '/' : lastRoute.current)} />}
    </>
  );
}
