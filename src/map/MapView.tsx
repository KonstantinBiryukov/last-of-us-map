/**
 * MapView.tsx — the React component that owns the Mapbox map.
 *
 * React renders an empty <div>; everything inside it belongs to Mapbox. The
 * component's job is wiring:
 *
 * It is only used when a Mapbox token is configured; otherwise JourneyScreen
 * shows FallbackMap instead (Mapbox GL JS requires a valid token for any use).
 *
 *   mount
 *     ├─ create the Mapbox map
 *     ├─ create markers, the camera director and the route-line controller
 *     ├─ on every style load: add route layers, terrain and the Three.js layer
 *     └─ register ONE task in the shared FrameLoop that, each frame,
 *          • updates the route reveal, • moves the camera, • asks for a repaint
 *   mode changes    → journey: route + 3D visible, story markers, camera follows;
 *                     explore: route + 3D hidden, neutral markers, free camera
 *   chapter changes → update marker states and the season light
 *   settings change → switch style / terrain
 *   unmount → remove everything (markers, listeners, map, WebGL resources)
 */
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAPBOX_TOKEN } from '../config/env';
import { LOCATIONS } from '../data/locations';
import { useJourney, usePlayback, useSettings } from '../journey/JourneyContext';
import { completedLegCount } from '../playback/timeline';
import { CameraDirector, type CameraMode } from './camera';
import { MarkerLayer } from './markers';
import { RouteLayerController, installRouteLayers, setJourneyLayersVisible } from './routeLayers';
import { STYLE_URLS, applyTerrain, configureBasemap, setSeasonLight } from './mapStyle';
import { JourneyLayer } from '../three/JourneyLayer';
import type { MapStyleId } from '../state/settings';
import type { LocationId } from '../data/types';
import type { ViewMode } from '../ui/viewMode';
import styles from './MapView.module.css';

export interface MapPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface MapViewProps {
  /** Space covered by UI panels; the camera keeps the travellers in the visible part. */
  padding: MapPadding;
  /** Called with a human-readable message (or null to clear it). */
  onNotice: (message: string | null) => void;
  /** Called if Mapbox cannot be used at all (no WebGL, token rejected); the app then shows FallbackMap. */
  onUnavailable: (reason: string) => void;
  /** 'journey' (the story) or 'explore' (free map, locations only). */
  mode: ViewMode;
  /** Location whose card is open in explore mode (highlighted), or null. */
  selectedLocation: LocationId | null;
  /** Called when a marker is clicked in explore mode. */
  onLocationSelect: (id: LocationId) => void;
}

/** Everything created together with one map instance (kept in a ref so later effects can reach it). */
interface MapParts {
  /** The Mapbox map itself. */
  map: mapboxgl.Map;
  /** The location buttons on the map. */
  markers: MarkerLayer;
  /** Moves the camera (follow / overview / free). */
  camera: CameraDirector;
  /** Keeps the route lines in step with the story. */
  routeController: RouteLayerController;
  /** Which base map is currently loaded (to detect when the user switches). */
  styleId: MapStyleId;
}

export function MapView({ padding, onNotice, onUnavailable, mode, selectedLocation, onLocationSelect }: MapViewProps) {
  const runtime = useJourney();
  const { engine, loop, settings, cameraSlot, reducedMotion } = runtime;
  /** The <div> Mapbox draws into. */
  const containerRef = useRef<HTMLDivElement>(null);
  /**
   * The current map and its helpers. A ref (not state) because changing it must NOT
   * re-render React — the map is managed imperatively, outside React's world.
   */
  const partsRef = useRef<MapParts | null>(null);
  /** True once the first style has loaded (layers exist); some effects wait for it. */
  const [ready, setReady] = useState(false);
  // Bumping `generation` tears the map down and builds a fresh one (used after a GPU context loss).
  const [generation, setGeneration] = useState(0);
  /** Last camera mode, remembered across a rebuild so following continues afterwards. */
  const cameraModeRef = useRef<CameraMode>('overview');
  const playback = usePlayback();
  const userSettings = useSettings();
  /**
   * The latest mode and click handler, kept in refs. The map, its markers and the frame
   * task are created ONCE; refs let those long-lived callbacks always see current values
   * without re-creating the map whenever React re-renders.
   */
  const modeRef = useRef<ViewMode>(mode);
  modeRef.current = mode;
  const onSelectRef = useRef(onLocationSelect);
  onSelectRef.current = onLocationSelect;

  // ───────────── create / destroy the map (once, and again after a context loss) ─────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!MAPBOX_TOKEN) {
      onUnavailable('No Mapbox token is configured.');
      return;
    }
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const styleId: MapStyleId = settings.getSnapshot().mapStyle;

    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        container,
        style: STYLE_URLS[styleId],
        projection: 'mercator', // keeps the Three.js maths simple and exact
        center: [-96, 39],
        zoom: 3.3,
        pitch: 0,
        antialias: true, // smooth edges for the 3D models
        maxPitch: 70,
        attributionControl: false,
        logoPosition: 'bottom-right',
        fadeDuration: 150,
        // Users may pan (only in Explore — see camera.ts) and zoom, but NOT rotate or tilt: right-click / Ctrl-drag, two-finger
        // twist and two-finger tilt are all switched off. Tilt and heading are cinematic
        // choices the camera director makes; letting a stray drag change them left the
        // camera in a broken, sideways "free-fly" state.
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
      map.touchZoomRotate.disableRotation(); // keep pinch-to-zoom, drop the twist-to-rotate part
      map.keyboard.disableRotation(); // Shift + arrow keys would rotate/tilt too
    } catch (error) {
      console.error(error);
      onUnavailable('Your browser could not start the 3D map (WebGL is unavailable).');
      return;
    }
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

    // Clicking a marker: in the journey it jumps the story there (the engine's jump event makes
    // the camera fly after it); in explore mode it opens that location's information card.
    const markers = new MarkerLayer(map, LOCATIONS, engine.chapters, (id) => {
      if (modeRef.current === 'explore') onSelectRef.current(id);
      else engine.goToLocation(id);
    });
    const camera = new CameraDirector(map, engine, {
      reducedMotion: () => reducedMotion,
      locationCoords: LOCATIONS.map((l) => l.coordinates),
    });
    const routeController = new RouteLayerController(map, engine.route);
    const parts: MapParts = { map, markers, camera, routeController, styleId };
    partsRef.current = parts;
    camera.jumpToOverview();
    // After a rebuild, return to following the travellers if that is what the user was doing.
    if (cameraModeRef.current === 'follow') map.once('style.load', () => camera.follow());
    const unsubscribeMode = camera.subscribe(() => (cameraModeRef.current = camera.getMode()));

    /** Makes a fresh Three.js layer (a new one is needed after every style change). */
    const createJourneyLayer = () =>
      new JourneyLayer(engine, {
        effectsEnabled: () => settings.getSnapshot().effects,
        reducedMotion: () => reducedMotion,
      });

    // Every time a style finishes loading (first load, or after switching style):
    const onStyleLoad = () => {
      const current = settings.getSnapshot();
      const season = engine.chapters[engine.frame.chapterIndex]!.season;
      configureBasemap(map, parts.styleId, season);
      applyTerrain(map, current.terrain);
      installRouteLayers(map, engine.route);
      routeController.invalidate();
      if (!map.getLayer('journey-3d')) map.addLayer(createJourneyLayer());
      // A new style starts with everything visible: re-apply the current mode.
      setJourneyLayersVisible(map, modeRef.current === 'journey');
      if (modeRef.current === 'explore') setSeasonLight(map, 'summer'); // neutral daylight for reading the map
      setReady(true);
    };
    map.on('style.load', onStyleLoad);

    // A rejected token (401/403, e.g. wrong URL restriction) makes Mapbox unusable:
    // hand over to the simplified FallbackMap so the journey keeps working.
    map.on('error', (event) => {
      const status = (event.error as { status?: number } | undefined)?.status;
      console.warn('Map error', event.error);
      if (status === 401 || status === 403) onUnavailable('The Mapbox token was rejected.');
    });

    // WebGL context loss (GPU reset, driver update, too many tabs). Mapbox's own in-place
    // restore can fail with the Standard style, so we rebuild the whole map from scratch
    // with a brand-new WebGL context. The story position lives in the engine, so nothing is lost.
    let rebuildTimer = 0;
    map.on('webglcontextlost', () => {
      onNotice('Graphics were interrupted — restoring the map…');
      rebuildTimer = window.setTimeout(() => setGeneration((g) => g + 1), 400);
    });
    if (generation > 0) map.once('idle', () => onNotice(null));

    // The ONE per-frame task for everything map-related (registered in the shared FrameLoop;
    // `removeTask` unregisters it in the cleanup below).
    const removeTask = loop.add((dt) => {
      // Explore mode shows no story: nothing to animate, and the map repaints by itself on interaction.
      if (modeRef.current === 'explore') return;
      const frame = engine.frame;
      routeController.update(
        completedLegCount(engine.timeline, frame.time),
        frame.travelling ? frame.legIndex : -1,
        frame.legProgress,
      );
      camera.frame(dt);
      // Only repaint continuously when something animates; an idle paused map costs nothing.
      if (engine.status === 'playing' || settings.getSnapshot().effects) map.triggerRepaint();
    });

    // Publish the camera so React controls (Follow/Overview buttons, keyboard) can use it.
    cameraSlot.setDirector(camera);

    // Cleanup: React runs this when the component unmounts or before re-running the effect.
    return () => {
      window.clearTimeout(rebuildTimer);
      removeTask();
      unsubscribeMode();
      cameraSlot.setDirector(null);
      camera.dispose();
      markers.remove();
      try {
        map.remove(); // also calls JourneyLayer.onRemove → frees all Three.js resources
      } catch (error) {
        console.warn('Map cleanup after a lost GPU context was incomplete', error);
      }
      partsRef.current = null;
      setReady(false);
    };
    // The runtime objects never change; only `generation` re-runs this effect.
  }, [generation]);

  // ───────────── mode changes: journey ↔ explore ─────────────
  useEffect(() => {
    const parts = partsRef.current;
    if (!parts) return;
    const exploring = mode === 'explore';
    parts.markers.setMode(mode);
    if (!ready) return;
    // Waiting for `ready` (first style loaded) also guarantees the panel padding has been
    // measured, so framing all locations accounts for the side panel.
    parts.camera.setExploring(exploring);
    setJourneyLayersVisible(parts.map, !exploring);
    // The chapter effect below runs after this one and restores story markers and light for the journey.
  }, [mode, ready, generation]);

  // ───────────── chapter changes (journey only): markers + season light ─────────────
  useEffect(() => {
    const parts = partsRef.current;
    if (!parts) return;
    if (mode === 'explore') {
      if (ready) setSeasonLight(parts.map, 'summer'); // neutral daylight while exploring
      return;
    }
    parts.markers.setChapter(playback.chapterIndex, LOCATIONS);
    if (ready) setSeasonLight(parts.map, engine.chapters[playback.chapterIndex]!.season);
  }, [playback.chapterIndex, ready, engine, mode, generation]);

  // ───────────── explore: highlight the location whose card is open ─────────────
  useEffect(() => {
    partsRef.current?.markers.setSelected(mode === 'explore' ? selectedLocation : null);
  }, [selectedLocation, mode, generation]);

  // ───────────── the story finished: show the whole journey ─────────────
  useEffect(() => {
    if (playback.status === 'finished' && modeRef.current === 'journey') partsRef.current?.camera.overview();
  }, [playback.status]);

  // ───────────── settings: style and terrain ─────────────
  useEffect(() => {
    const parts = partsRef.current;
    if (!parts || !ready) return;
    if (userSettings.mapStyle !== parts.styleId) {
      parts.styleId = userSettings.mapStyle;
      parts.map.setStyle(STYLE_URLS[userSettings.mapStyle]); // style.load re-adds our layers
    } else {
      applyTerrain(parts.map, userSettings.terrain);
    }
  }, [userSettings.mapStyle, userSettings.terrain, ready]);

  // ───────────── padding (space under the story panel / player bar) ─────────────
  useEffect(() => {
    // Through the camera director, so a camera flight in progress survives the change.
    partsRef.current?.camera.setPadding(padding);
  }, [padding, generation]);

  return <div ref={containerRef} className={styles.map} role="region" aria-label="Map of Joel and Ellie's journey" />;
}
