/**
 * FallbackMap.tsx — a lightweight map used when Mapbox cannot run.
 *
 * WHEN: no Mapbox token is configured, the token is rejected, or the browser
 * has no WebGL. Mapbox GL JS (v2 and later) may only be used with a valid
 * access token, so instead of trying to work around that we draw our own
 * simple map with SVG:
 *
 *   • the whole route, in the same flat "Web Mercator" projection Mapbox uses
 *     (dashed arcs for jumps, a dotted arc for the time skip);
 *   • the travelled part in amber, revealed progressively;
 *   • a glowing dot for Joel and Ellie;
 *   • every location as a keyboard-accessible button that jumps to its chapter.
 *
 * In "Explore the map" mode only the locations are drawn (no route, no dot) and
 * clicking one opens its information card, exactly like the Mapbox version.
 *
 * There are no map tiles and no 3D, but the journey, slideshow and music stay
 * fully synchronised, because this component reads the same playback engine.
 * Per-frame updates touch only two SVG attributes (no React re-render).
 */
import { useEffect, useMemo, useRef } from 'react';
import { LOCATIONS } from '../data/locations';
import type { LngLat } from '../data/types';
import { useJourney, usePlayback } from '../journey/JourneyContext';
import { mercatorX, mercatorY } from '../geo/mercator';
import { completedLegCount } from '../playback/timeline';
import { markerStates } from './markers';
import type { MapPadding } from './MapView';
import type { LocationId } from '../data/types';
import type { ViewMode } from '../ui/viewMode';
import styles from './FallbackMap.module.css';

/** SVG coordinates are mercator × this factor (keeps numbers readable). */
const SCALE = 10_000;
/** At most this many points per leg in the SVG path (the original has up to 4 000). */
const MAX_POINTS_PER_LEG = 300;

function project(c: LngLat): [number, number] {
  return [mercatorX(c[0]) * SCALE, mercatorY(c[1]) * SCALE];
}

function pathFor(points: readonly LngLat[]): string {
  const step = Math.max(1, Math.ceil(points.length / MAX_POINTS_PER_LEG));
  let d = '';
  for (let i = 0; i < points.length; i += step) {
    const [x, y] = project(points[i]!);
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
  }
  const [lx, ly] = project(points[points.length - 1]!);
  return `${d}L${lx.toFixed(2)},${ly.toFixed(2)}`;
}

interface FallbackMapProps {
  /** Space covered by UI panels (the SVG is drawn inside the rest). */
  padding: MapPadding;
  /** 'journey' draws the route and progress; 'explore' shows only the locations. */
  mode: ViewMode;
  /** Location whose card is open in explore mode. */
  selectedLocation: LocationId | null;
  /** Called when a location is clicked in explore mode. */
  onLocationSelect: (id: LocationId) => void;
}

export function FallbackMap({ padding, mode, selectedLocation, onLocationSelect }: FallbackMapProps) {
  const exploring = mode === 'explore';
  const { engine, loop } = useJourney();
  const playback = usePlayback();
  const { route } = engine;

  // Build the static geometry once.
  const geometry = useMemo(() => {
    // Jumps are already smooth arcs (geo/route.ts corrects them), so every leg is drawn the same way.
    const legs = route.legs.map((leg) => ({ kind: leg.kind, d: pathFor(leg.coordinates) }));
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const leg of route.legs) {
      for (const c of leg.coordinates) {
        const [x, y] = project(c);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    const margin = Math.max(maxX - minX, maxY - minY) * 0.06;
    const viewBox = `${minX - margin} ${minY - margin} ${maxX - minX + 2 * margin} ${maxY - minY + 2 * margin}`;
    const unit = (maxX - minX) / 300; // ~1 "pixel" of a 300-wide map, for stroke widths
    return { legs, viewBox, unit };
  }, [route]);

  const activeRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGGElement>(null);
  const legRefs = useRef<(SVGPathElement | null)[]>([]);

  // Per-frame: move the dot, reveal the active leg, mark completed legs.
  useEffect(() => {
    let lastCompleted = -1;
    let lastActive = -2;
    const point: [number, number] = [0, 0];
    return loop.add(() => {
      const frame = engine.frame;
      route.journey.pointAt(frame.distance, point);
      const [x, y] = project(point);
      dotRef.current?.setAttribute('transform', `translate(${x} ${y})`);

      const completed = completedLegCount(engine.timeline, frame.time);
      if (completed !== lastCompleted) {
        lastCompleted = completed;
        legRefs.current.forEach((el, i) => el?.setAttribute('data-done', String(i < completed)));
      }
      const active = frame.travelling ? frame.legIndex : -1;
      const el = activeRef.current;
      if (!el) return;
      if (active !== lastActive) {
        lastActive = active;
        el.setAttribute('d', active >= 0 ? geometry.legs[active]!.d : '');
      }
      // pathLength="1" lets us reveal a fraction of the path with one dash value.
      if (active >= 0) el.setAttribute('stroke-dasharray', `${frame.legProgress} 1`);
    });
  }, [loop, engine, route, geometry]);

  const states = markerStates(engine.chapters, LOCATIONS, playback.chapterIndex);
  /** Clicking a location: jump the story there (journey) or open its card (explore). */
  const selectLocation = (id: LocationId) => (exploring ? onLocationSelect(id) : engine.goToLocation(id));
  const u = geometry.unit;

  return (
    <div
      className={styles.wrap}
      style={{ left: padding.left, right: padding.right, top: padding.top, bottom: padding.bottom }}
    >
      <svg className={styles.svg} viewBox={geometry.viewBox} role="group" aria-label="Simplified map of the journey">
        <defs>
          <filter id="fallback-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={u * 1.5} />
          </filter>
        </defs>
        {/* The route is journey-only: hidden in Explore (kept mounted so the refs stay valid). */}
        <g visibility={exploring ? 'hidden' : 'visible'}>
        {geometry.legs.map((leg, i) => (
          <path
            key={i}
            ref={(el) => {
              legRefs.current[i] = el;
            }}
            d={leg.d}
            className={`${styles.leg} ${styles[leg.kind]}`}
            strokeWidth={leg.kind === 'detailed' ? u * 1.2 : u * 0.9}
            strokeDasharray={leg.kind === 'jump' ? `${u * 3} ${u * 3}` : leg.kind === 'timeskip' ? `${u * 0.1} ${u * 2.5}` : undefined}
          />
        ))}
        <path ref={activeRef} className={styles.active} pathLength={1} strokeWidth={u * 1.8} d="" />
        </g>

        {LOCATIONS.map((location) => {
          const [x, y] = project(location.coordinates);
          // Explore has no story state: selected location = highlighted, the rest = neutral ("visited" look).
          const state = exploring
            ? location.id === selectedLocation
              ? 'current'
              : 'visited'
            : (states.get(location.id) ?? 'upcoming');
          return (
            <g
              key={location.id}
              className={styles.marker}
              data-state={state}
              transform={`translate(${x} ${y})`}
              role="button"
              tabIndex={0}
              aria-label={location.title}
              onClick={() => selectLocation(location.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault(); // stop Space from scrolling the page
                  selectLocation(location.id);
                }
              }}
            >
              <circle r={u * (state === 'current' ? 5 : 3.6)} className={styles.markerDot} strokeWidth={u * 0.8} />
              <text y={-u * 7} className={styles.markerLabel} fontSize={u * 4.2}>
                {location.shortName}
              </text>
            </g>
          );
        })}

        <g ref={dotRef} aria-hidden="true" visibility={exploring ? 'hidden' : 'visible'}>
          <circle r={u * 5} className={styles.dotGlow} filter="url(#fallback-glow)" />
          <circle r={u * 2.2} className={styles.dot} />
        </g>
      </svg>
    </div>
  );
}
