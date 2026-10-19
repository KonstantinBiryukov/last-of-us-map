/**
 * routeLayers.ts — the route lines and jump arrows, drawn by Mapbox.
 *
 * Visual states, from bottom to top:
 *
 *   1. remaining  – the whole journey as a thin pale line (with a dark soft
 *                   "casing" underneath so it reads over satellite imagery), so
 *                   you can always see where the story is going.
 *   2. jumps      – stretches with no detailed path: dashed arcs (dotted for the
 *                   twenty-year time skip) with small ARROW HEADS repeated along
 *                   them, pointing the way. Bright once reached, faint before.
 *   3. completed  – legs already travelled: a solid warm line with a soft glow.
 *   4. active     – the leg being travelled RIGHT NOW, revealed progressively:
 *                   Mapbox's `line-trim-offset` hides the part of the line the
 *                   travellers have not reached yet. Updating one paint property
 *                   per frame is very cheap (no new data is uploaded to the GPU).
 *
 * Mapbox (not Three.js) draws these because Mapbox lines stay perfectly sharp at
 * every zoom level and drape over 3D terrain automatically.
 *
 * Mapbox "expressions" used below are small formulas written as arrays, e.g.
 *   ['get', 'kind']                    → read the feature's "kind" property
 *   ['==', ['get', 'kind'], 'jump']    → is it a jump?
 *   ['interpolate', ['linear'], ['zoom'], 3, 1.3, 10, 2.4]
 *                                      → 1.3 px at zoom 3, 2.4 px at zoom 10, smooth in between
 */
import type { ExpressionSpecification, GeoJSONSource, Map as MapboxMap } from 'mapbox-gl';
import type { FeatureCollection, Feature, LineString } from 'geojson';
import type { Route } from '../geo/route';
import { mercatorX, mercatorY } from '../geo/mercator';
import { isJumpKind } from '../playback/timeline';

/** The route's colour palette (CSS colours). */
export const ROUTE_COLORS = {
  remaining: '#e9dcc4', // bone white
  completed: '#f2b45c', // warm amber
  glow: '#ff9d3d', // deeper amber for the soft glow
  active: '#ffd38a', // bright amber for the line being revealed
  jump: '#dfe9f5', // cool white for jumps (they are "not a road")
} as const;

/** Source ids (a "source" is a dataset; "layers" are different ways to draw it). */
const SRC_LEGS = 'journey-legs';
const SRC_ACTIVE = 'journey-active';
/** Id of the arrow image registered with the map. */
const ARROW_IMAGE = 'journey-arrow';

/** Properties stored on every leg feature (used by filters and expressions). */
type LegProps = { legIndex: number; kind: string; mode: string };

/** Turns the route into a GeoJSON collection: one LineString feature per leg. */
function legsCollection(route: Route): FeatureCollection<LineString, LegProps> {
  const features: Feature<LineString, LegProps>[] = route.legs.map((leg, legIndex) => ({
    type: 'Feature',
    properties: { legIndex, kind: leg.kind, mode: leg.mode },
    // GeoJSON wants plain mutable arrays, so copy each readonly [lng, lat].
    geometry: { type: 'LineString', coordinates: leg.coordinates.map((c) => [c[0], c[1]]) },
  }));
  return { type: 'FeatureCollection', features };
}

function emptyCollection(): FeatureCollection<LineString> {
  return { type: 'FeatureCollection', features: [] };
}

/**
 * Draws the arrow head used along jump arcs on a small canvas and registers it.
 * It points RIGHT, because Mapbox aligns an icon's x-axis with the line direction
 * when icons are placed along a line.
 */
function addArrowImage(map: MapboxMap): void {
  if (map.hasImage(ARROW_IMAGE)) return;
  const size = 48; // drawn at 2× for sharpness on Retina screens (pixelRatio: 2 below)
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.lineJoin = 'round';
  ctx.beginPath(); // a chevron-like arrow head: tip on the right
  ctx.moveTo(size * 0.82, size * 0.5);
  ctx.lineTo(size * 0.3, size * 0.2);
  ctx.lineTo(size * 0.42, size * 0.5);
  ctx.lineTo(size * 0.3, size * 0.8);
  ctx.closePath();
  ctx.fillStyle = '#f4f8ff';
  ctx.strokeStyle = 'rgba(10, 9, 8, 0.85)'; // dark outline: readable on bright imagery
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fill();
  const image = ctx.getImageData(0, 0, size, size);
  map.addImage(ARROW_IMAGE, image, { pixelRatio: 2 });
}

/**
 * Adds sources and layers. Safe to call again after a style change (Mapbox
 * forgets everything we added when the style is replaced).
 */
export function installRouteLayers(map: MapboxMap, route: Route): void {
  if (map.getSource(SRC_LEGS)) return; // already installed for this style

  map.addSource(SRC_LEGS, { type: 'geojson', data: legsCollection(route) });
  // `lineMetrics: true` is required for line-trim-offset (progressive reveal).
  map.addSource(SRC_ACTIVE, { type: 'geojson', data: emptyCollection(), lineMetrics: true });
  addArrowImage(map);

  // Reusable filters.
  const isDetailed: ExpressionSpecification = ['==', ['get', 'kind'], 'detailed'];
  const isJump: ExpressionSpecification = ['==', ['get', 'kind'], 'jump'];
  const isTimeskip: ExpressionSpecification = ['==', ['get', 'kind'], 'timeskip'];
  const isAnyJump: ExpressionSpecification = ['!=', ['get', 'kind'], 'detailed'];
  // Matches nothing yet; RouteLayerController replaces it as the story advances.
  const noneYet: ExpressionSpecification = ['<', ['get', 'legIndex'], -1];

  // 1) Dark casing + pale remaining line for detailed legs.
  map.addLayer({
    id: 'route-casing',
    type: 'line',
    source: SRC_LEGS,
    filter: isDetailed,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#0b0a08',
      'line-opacity': 0.55,
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 4, 10, 7],
      'line-blur': 2,
      'line-emissive-strength': 1, // keep full brightness in night/dusk light presets
    },
  });
  map.addLayer({
    id: 'route-remaining',
    type: 'line',
    source: SRC_LEGS,
    filter: isDetailed,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ROUTE_COLORS.remaining,
      'line-opacity': 0.6,
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.3, 10, 2.4],
      'line-emissive-strength': 1,
    },
  });

  // 2) Jumps (dashed) and the time skip (dotted). Mapbox cannot change the dash pattern
  //    per feature with an expression, so each pattern gets its own layer.
  map.addLayer({
    id: 'route-jump',
    type: 'line',
    source: SRC_LEGS,
    filter: isJump,
    layout: { 'line-cap': 'butt' },
    paint: {
      'line-color': ROUTE_COLORS.jump,
      'line-opacity': 0.7,
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.6, 10, 2.6],
      'line-dasharray': [2.5, 2],
      'line-emissive-strength': 1,
    },
  });
  map.addLayer({
    id: 'route-timeskip',
    type: 'line',
    source: SRC_LEGS,
    filter: isTimeskip,
    layout: { 'line-cap': 'round' },
    paint: {
      'line-color': ROUTE_COLORS.jump,
      'line-opacity': 0.8,
      'line-width': 2.4,
      'line-dasharray': [0.1, 2.2], // round caps + tiny dashes = a dotted line
      'line-emissive-strength': 1,
    },
  });
  // Arrow heads repeated along every jump/time-skip arc, rotated to follow the line.
  map.addLayer({
    id: 'route-jump-arrows',
    type: 'symbol',
    source: SRC_LEGS,
    filter: isAnyJump,
    layout: {
      'symbol-placement': 'line', // place icons ALONG the line…
      'symbol-spacing': 110, // …one every 110 px
      'icon-image': ARROW_IMAGE,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.8, 8, 1.1],
      'icon-allow-overlap': true, // never hide arrows because of label collisions
      'icon-ignore-placement': true,
      'icon-rotation-alignment': 'map', // rotate with the line, not the screen
    },
    paint: {
      'icon-opacity': 0.45, // faint until reached; RouteLayerController brightens reached ones
      'icon-emissive-strength': 1,
    },
  });

  // 3) Completed legs: glow + solid line (detailed) and amber dashes (jumps).
  map.addLayer({
    id: 'route-completed-glow',
    type: 'line',
    source: SRC_LEGS,
    filter: ['all', isDetailed, noneYet],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ROUTE_COLORS.glow,
      'line-opacity': 0.25,
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 6, 10, 14],
      'line-blur': 6,
      'line-emissive-strength': 1,
    },
  });
  map.addLayer({
    id: 'route-completed',
    type: 'line',
    source: SRC_LEGS,
    filter: ['all', isDetailed, noneYet],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ROUTE_COLORS.completed,
      'line-opacity': 0.95,
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.8, 10, 3.6],
      'line-emissive-strength': 1,
    },
  });
  map.addLayer({
    id: 'route-jump-completed',
    type: 'line',
    source: SRC_LEGS,
    filter: ['all', isAnyJump, noneYet],
    layout: { 'line-cap': 'butt' },
    paint: {
      'line-color': ROUTE_COLORS.completed,
      'line-opacity': 0.85,
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.8, 10, 2.8],
      'line-dasharray': [2.5, 2],
      'line-emissive-strength': 1,
    },
  });

  // 4) The leg being travelled, revealed up to the travellers.
  map.addLayer({
    id: 'route-active-glow',
    type: 'line',
    source: SRC_ACTIVE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ROUTE_COLORS.glow,
      'line-opacity': 0.45,
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 8, 10, 18],
      'line-blur': 8,
      'line-trim-offset': [0, 1],
      'line-emissive-strength': 1,
    },
  });
  map.addLayer({
    id: 'route-active',
    type: 'line',
    source: SRC_ACTIVE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ROUTE_COLORS.active,
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2.4, 10, 4.5],
      'line-trim-offset': [0, 1],
      'line-emissive-strength': 1,
    },
  });
}

/**
 * Keeps the line layers in step with the story. Remembers what it last sent to
 * Mapbox so it only talks to Mapbox when something actually changed (most
 * frames it does nothing except move the reveal tip).
 */
export class RouteLayerController {
  /** Last values sent to Mapbox (-2 = "never sent", forces the first update). */
  private completedCount = -2;
  private activeLeg = -2;
  private reachedJumps = -2;
  private lastTrim = -1;
  private readonly map: MapboxMap;
  private readonly route: Route;
  /** Cumulative mercator lengths per leg, computed the first time a leg becomes active. */
  private mercatorCumulative = new Map<number, Float64Array>();

  constructor(map: MapboxMap, route: Route) {
    this.map = map;
    this.route = route;
  }

  /** Forget cached state (call after the style was reloaded and layers were re-added). */
  invalidate(): void {
    this.completedCount = -2;
    this.activeLeg = -2;
    this.reachedJumps = -2;
    this.lastTrim = -1;
  }

  /**
   * @param completedCount number of legs fully travelled (legs 0 … completedCount-1)
   * @param activeLeg      leg being travelled, or -1
   * @param progress       0‥1 along the active leg (the WHOLE leg)
   */
  update(completedCount: number, activeLeg: number, progress: number): void {
    const map = this.map;
    if (!map.getLayer('route-completed')) return; // style still loading

    if (completedCount !== this.completedCount) {
      this.completedCount = completedCount;
      const done: ExpressionSpecification = ['<', ['get', 'legIndex'], completedCount];
      map.setFilter('route-completed', ['all', ['==', ['get', 'kind'], 'detailed'], done]);
      map.setFilter('route-completed-glow', ['all', ['==', ['get', 'kind'], 'detailed'], done]);
      map.setFilter('route-jump-completed', ['all', ['!=', ['get', 'kind'], 'detailed'], done]);
    }

    // Arrow heads light up for every jump already reached (completed or in progress).
    const reached = activeLeg >= 0 && isJumpKind(this.route.legs[activeLeg]!.kind) ? activeLeg + 1 : completedCount;
    if (reached !== this.reachedJumps) {
      this.reachedJumps = reached;
      map.setPaintProperty('route-jump-arrows', 'icon-opacity', ['case', ['<', ['get', 'legIndex'], reached], 1, 0.4]);
    }

    if (activeLeg !== this.activeLeg) {
      this.activeLeg = activeLeg;
      this.lastTrim = -1;
      const source = map.getSource(SRC_ACTIVE) as GeoJSONSource | undefined;
      const data: FeatureCollection<LineString> =
        activeLeg >= 0
          ? {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'LineString',
                    coordinates: this.route.legs[activeLeg]!.coordinates.map((c) => [c[0], c[1]]),
                  },
                },
              ],
            }
          : emptyCollection();
      source?.setData(data);
      // Jumps are revealed as dashes, detailed legs as a solid line.
      const dashed = activeLeg >= 0 && isJumpKind(this.route.legs[activeLeg]!.kind);
      map.setPaintProperty('route-active', 'line-dasharray', dashed ? [2.5, 2] : undefined);
      map.setPaintProperty('route-active-glow', 'line-opacity', dashed ? 0.2 : 0.45);
    }

    if (activeLeg >= 0) {
      // Mapbox measures "line progress" in flat map (mercator) length, while our story
      // measures real metres. Convert, so the reveal tip sits exactly under the travellers.
      const p = this.mercatorProgress(activeLeg, Math.min(Math.max(progress, 0), 1));
      if (Math.abs(p - this.lastTrim) > 0.0005) {
        this.lastTrim = p;
        // line-trim-offset hides the range [start, end]; we hide from the travellers to the end.
        const trim: [number, number] = p >= 1 ? [1, 1] : [p, 1];
        map.setPaintProperty('route-active', 'line-trim-offset', trim);
        map.setPaintProperty('route-active-glow', 'line-trim-offset', trim);
      }
    }
  }

  /**
   * Converts "fraction of the leg in METRES" into "fraction in MERCATOR length".
   * They differ slightly because the Mercator projection stretches distances
   * more the further north you go.
   */
  private mercatorProgress(legIndex: number, metreProgress: number): number {
    const line = this.route.legLines[legIndex]!;
    let cumulative = this.mercatorCumulative.get(legIndex);
    if (!cumulative) {
      // cumulative[i] = flat-map length from the first point to point i.
      cumulative = new Float64Array(line.count);
      let total = 0;
      for (let i = 1; i < line.count; i++) {
        const dx = mercatorX(line.coords[i * 2]!) - mercatorX(line.coords[i * 2 - 2]!);
        const dy = mercatorY(line.coords[i * 2 + 1]!) - mercatorY(line.coords[i * 2 - 1]!);
        total += Math.hypot(dx, dy);
        cumulative[i] = total;
      }
      this.mercatorCumulative.set(legIndex, cumulative);
    }
    const total = cumulative[line.count - 1]!;
    if (total === 0 || line.length === 0) return metreProgress;
    // Find the segment by metres, then read the same fraction of that segment in mercator length.
    const d = metreProgress * line.length;
    const i = line.segmentIndexAt(d);
    const segMetres = line.cumulative[i + 1]! - line.cumulative[i]!;
    const t = segMetres > 0 ? (d - line.cumulative[i]!) / segMetres : 0;
    const m = cumulative[i]! + (cumulative[i + 1]! - cumulative[i]!) * t;
    return m / total;
  }
}

/** Every layer that belongs to the journey (route lines, jump arrows) plus the 3D travellers layer. */
const JOURNEY_LAYER_IDS = [
  'route-casing',
  'route-remaining',
  'route-jump',
  'route-timeskip',
  'route-jump-arrows',
  'route-completed-glow',
  'route-completed',
  'route-jump-completed',
  'route-active-glow',
  'route-active',
  'journey-3d',
] as const;

/**
 * Shows or hides everything journey-related at once. "Explore the map" hides it all,
 * leaving only the base map and the location markers. Hiding uses the layout property
 * `visibility` — the layers and their data stay loaded, so switching back is instant
 * (and a hidden custom layer's render() is not even called, so the 3D layer costs nothing).
 */
export function setJourneyLayersVisible(map: MapboxMap, visible: boolean): void {
  for (const id of JOURNEY_LAYER_IDS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  }
}
