/**
 * JourneyScreen.tsx — lays out the experience and connects URL routes to actions.
 *
 * It hosts BOTH experiences on top of one shared map (so switching is instant and
 * the map never reloads):
 *
 *   journey (#/path, #/chapter/N) – story panel + slideshow, player bar, route,
 *                                   travellers, camera follow (described below);
 *   explore (#/map)               – "Explore the map": only the base map and the
 *                                   location markers, a free camera, and a side
 *                                   panel listing the places; clicking a place opens
 *                                   a card to read about it. A small music bar stays.
 *
 * Journey visual hierarchy (desktop):
 *   1. the map, full screen, behind everything
 *   2. the travellers and route on the map
 *   3. the story panel (chapter, slideshow, place) on the left
 *   4. the player bar (journey + music) along the bottom
 *   5. small map controls on the right
 *
 * On phones the layout is reorganised, not just shrunk: the map takes the top
 * part of the screen, the story scrolls below it, and the player sits at the
 * bottom with a compact music section.
 *
 * The map needs to know which parts of it are covered by panels ("padding"),
 * so the camera centres the travellers in the part you can actually see.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MapView, type MapPadding } from '../map/MapView';
import { FallbackMap } from '../map/FallbackMap';
import { useCameraDirector, useJourney } from '../journey/JourneyContext';
import type { AppRoute } from './useHashRoute';
import { StoryPanel } from './StoryPanel';
import { PlayerBar } from './PlayerBar';
import { MapControls } from './MapControls';
import { ChapterTitle } from './ChapterTitle';
import { ErrorBoundary } from './ErrorBoundary';
import { HomeIcon, InfoIcon } from './icons';
import { ExplorePanel } from './ExplorePanel';
import { MusicControls } from './MusicControls';
import { STATS_ENABLED, StatsMeter } from './StatsMeter';
import type { LocationId } from '../data/types';
import type { ViewMode } from './viewMode';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useMediaQuery } from './useMediaQuery';
import styles from './JourneyScreen.module.css';

interface JourneyScreenProps {
  route: AppRoute;
  /** True while the intro or about overlay covers the screen. */
  covered: boolean;
  /** Opens the About overlay. */
  onAbout: () => void;
  /** Returns to the title screen (main menu). */
  onMenu: () => void;
  /** Changes the URL (used to switch from Explore to the journey). */
  navigate: (path: string) => void;
}

const ZERO_PADDING: MapPadding = { top: 0, right: 0, bottom: 0, left: 0 };

export function JourneyScreen({ route, covered, onAbout, onMenu, navigate }: JourneyScreenProps) {
  const runtime = useJourney();
  /**
   * Which experience is on screen. The title screen and About are overlays, so while
   * they are open we keep showing whatever mode was underneath (remembered in a ref).
   */
  const modeRef = useRef<ViewMode>('journey');
  if (route.name === 'explore') modeRef.current = 'explore';
  else if (route.name === 'journey' || route.name === 'chapter') modeRef.current = 'journey';
  const mode = modeRef.current;
  const exploring = mode === 'explore';
  /** Location whose card is open in Explore (null = the list of places). */
  const [selectedLocation, setSelectedLocation] = useState<LocationId | null>(null);
  const mobile = useMediaQuery('(max-width: 899px)');
  const panelRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const mapAreaRef = useRef<HTMLDivElement>(null);
  const [padding, setPadding] = useState<MapPadding>(ZERO_PADDING);
  const [notice, setNotice] = useState<string | null>(null);
  // Set when Mapbox cannot run (no token, rejected token, no WebGL): we then show the SVG FallbackMap.
  const [mapUnavailable, setMapUnavailable] = useState<string | null>(null);

  // Journey shortcuts (Space, arrows…) make no sense in Explore, where the story is hidden.
  useKeyboardShortcuts(runtime, !covered && !exploring);
  useRouteActions(route);

  /**
   * Explore → journey ("Begin the journey" or a chapter button on a location card).
   * Runs inside a real click, so starting the music is allowed by the browser.
   */
  const startJourney = useCallback(
    (chapterNumber?: number) => {
      const { engine, music, cameraSlot } = runtime;
      if (chapterNumber !== undefined) engine.goToChapter(chapterNumber - 1);
      if (engine.status === 'finished') engine.replay();
      else engine.play();
      if (music.getSnapshot().status !== 'playing') void music.play();
      cameraSlot.getSnapshot().director?.follow();
      navigate('/path');
    },
    [runtime, navigate],
  );

  // Measure the panels whenever their size changes and tell the map what is covered.
  useLayoutEffect(() => {
    const measure = () => {
      const area = mapAreaRef.current?.getBoundingClientRect();
      if (!area) return;
      if (mobile) {
        setPadding({ top: 56, right: 56, bottom: 24, left: 24 });
        return;
      }
      const panel = panelRef.current?.getBoundingClientRect();
      const bar = barRef.current?.getBoundingClientRect();
      const next: MapPadding = {
        top: 70,
        right: 80,
        left: panel ? Math.round(panel.right + 24) : 0,
        // In Explore the music bar is small and sits in a corner, so it does not count.
        bottom: bar && !exploring ? Math.round(area.bottom - bar.top + 24) : 40,
      };
      setPadding((prev) =>
        prev.top === next.top && prev.right === next.right && prev.left === next.left && prev.bottom === next.bottom
          ? prev
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const el of [panelRef.current, barRef.current, mapAreaRef.current]) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [mobile, exploring]);

  // Centre of the visible map area, for the chapter title card.
  const centreX = `calc(${padding.left}px + (100% - ${padding.left + padding.right}px) / 2)`;

  return (
    <div className={styles.screen} inert={covered}>
      {STATS_ENABLED && <StatsMeter />}
      <div ref={mapAreaRef} className={styles.mapArea} style={{ ['--map-centre-x' as string]: centreX }}>
        {mapUnavailable ? (
          <FallbackMap padding={padding} mode={mode} selectedLocation={selectedLocation} onLocationSelect={setSelectedLocation} />
        ) : (
          <ErrorBoundary
            fallback={
              <FallbackMap padding={padding} mode={mode} selectedLocation={selectedLocation} onLocationSelect={setSelectedLocation} />
            }
          >
            <MapView
              padding={padding}
              onNotice={setNotice}
              onUnavailable={setMapUnavailable}
              mode={mode}
              selectedLocation={selectedLocation}
              onLocationSelect={setSelectedLocation}
            />
          </ErrorBoundary>
        )}
        {!exploring && <ChapterTitle />}
        {!mapUnavailable && (
          <div className={styles.controls}>
            <MapControls explore={exploring} />
          </div>
        )}
        <header className={styles.brand}>
          <button type="button" className={styles.about} onClick={onMenu} aria-label="Main menu" title="Main menu">
            <HomeIcon size={16} />
          </button>
          <span className={styles.brandTitle}>The Last of Us</span>
          <span className={styles.brandSub}>{exploring ? 'Explore the map' : 'The Journey'}</span>
          <button type="button" className={styles.about} onClick={onAbout} aria-label="About this project" title="About">
            <InfoIcon size={16} />
          </button>
        </header>
        {(mapUnavailable || notice) && (
          <div className={styles.notice} role="status">
            {mapUnavailable
              ? `${mapUnavailable} Showing a simplified map — the story, images and music work as usual. See IMPLEMENTATION_GUIDE.md to enable the full 3D map.`
              : notice}
          </div>
        )}
      </div>

      {exploring ? (
        <>
          <aside ref={panelRef} className={styles.story} data-mode="explore">
            <ExplorePanel selected={selectedLocation} onSelect={setSelectedLocation} onStartJourney={startJourney} />
          </aside>
          {/* Only the soundtrack stays from the player: there is no story timeline in Explore. */}
          <footer ref={barRef} className={styles.music}>
            <MusicControls compact />
          </footer>
        </>
      ) : (
        <>
          <aside ref={panelRef} className={styles.story}>
            <StoryPanel />
          </aside>
          <footer ref={barRef} className={styles.player}>
            <PlayerBar compact={mobile} />
          </footer>
        </>
      )}
    </div>
  );
}

/**
 * Turns the URL into actions on the runtime:
 *   #/path  → play and follow       #/map → pause the story (Explore takes over the map)
 *   #/chapter/N → jump to chapter N and follow
 * Runs again when the camera director appears (the map loads asynchronously).
 */
function useRouteActions(route: AppRoute): void {
  const { engine } = useJourney();
  const director = useCameraDirector();
  const routeKey = route.name === 'chapter' ? `chapter-${route.chapterNumber}` : route.name;
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!director) return;
    if (handled.current === routeKey) return;
    handled.current = routeKey;
    switch (route.name) {
      case 'journey':
        // Opening #/path directly: start playing. Coming back from About must NOT
        // un-pause a story the user paused, so only an untouched ("idle") story auto-plays.
        if (engine.status === 'idle') engine.play();
        // Follow the travellers unless the user already took the camera ("free").
        if (director.getMode() === 'overview') director.follow();
        break;
      case 'explore':
        // Explore shows no story, so hold it where it is. (MapView switches the map itself:
        // route hidden, neutral markers, free camera framing all locations.)
        engine.pause();
        break;
      case 'chapter':
        engine.goToChapter(route.chapterNumber - 1);
        director.follow();
        break;
      case 'intro':
        // Back on the title screen ("Main menu"): hold the story where it is.
        engine.pause();
        break;
      case 'about':
        break;
    }
  }, [director, routeKey, route, engine]);
}
