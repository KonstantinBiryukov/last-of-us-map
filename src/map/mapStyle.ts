/**
 * mapStyle.ts — which Mapbox base map to use, and how it is tuned.
 *
 * We use Mapbox's "Standard" family of styles because they can be configured
 * live (light preset, labels) without reloading:
 *   satellite – real satellite imagery (the original "path" mode used satellite);
 *   atlas     – a muted cartographic map, easier to read at a glance.
 *
 * The light preset follows the story's seasons, so the world itself gets
 * darker or warmer as the journey goes on: the prologue happens at night (the
 * outbreak), fall at dusk, winter at a cold dawn.
 */
import type { Map as MapboxMap } from 'mapbox-gl';
import type { Season } from '../data/types';
import type { MapStyleId } from '../state/settings';

export const STYLE_URLS: Record<MapStyleId, string> = {
  satellite: 'mapbox://styles/mapbox/standard-satellite',
  atlas: 'mapbox://styles/mapbox/standard',
};

/** Mapbox Standard's built-in lighting moods. */
type LightPreset = 'dawn' | 'day' | 'dusk' | 'night';

/** Which light each season uses. */
export const SEASON_LIGHT: Record<Season, LightPreset> = {
  prologue: 'night',
  summer: 'day',
  fall: 'dusk',
  winter: 'dawn',
  spring: 'day',
};

/** Applies the light preset and hides clutter (POIs, transit) on Standard styles. */
export function configureBasemap(map: MapboxMap, style: MapStyleId, season: Season): void {
  const set = (key: string, value: string | boolean) => {
    try {
      map.setConfigProperty('basemap', key, value);
    } catch {
      // Older/non-Standard style without this option: nothing to configure.
    }
  };
  set('lightPreset', SEASON_LIGHT[season]);
  set('showPointOfInterestLabels', false);
  set('showTransitLabels', false);
  set('showRoadLabels', false);
  if (style === 'atlas') {
    set('theme', 'faded');
    set('show3dObjects', false);
  } else {
    set('showRoadsAndTransit', false);
    set('showPedestrianRoads', false);
  }
}

/** Changes only the light preset (Mapbox animates the transition). */
export function setSeasonLight(map: MapboxMap, season: Season): void {
  try {
    map.setConfigProperty('basemap', 'lightPreset', SEASON_LIGHT[season]);
  } catch {
    // Non-Standard style: no light presets.
  }
}

/** Id of the elevation data source (DEM = Digital Elevation Model: a height for every pixel). */
const DEM_SOURCE = 'mapbox-dem';

/** Turns real 3D terrain on or off (mountains in Colorado/Wyoming look great). */
export function applyTerrain(map: MapboxMap, enabled: boolean): void {
  try {
    if (enabled) {
      if (!map.getSource(DEM_SOURCE)) {
        map.addSource(DEM_SOURCE, {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14,
        });
      }
      map.setTerrain({ source: DEM_SOURCE, exaggeration: 1.35 });
    } else {
      map.setTerrain(null);
    }
  } catch (error) {
    console.warn('Terrain unavailable', error);
  }
}
