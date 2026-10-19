/**
 * mercator.ts — converting longitude/latitude into the map's flat coordinates.
 *
 * Mapbox draws the Earth as a flat square ("Web Mercator"): the whole world is
 * a 1 × 1 square, x grows to the east, y grows to the SOUTH. Three.js objects
 * are placed in that same square so they line up perfectly with the map.
 *
 * These formulas match mapboxgl.MercatorCoordinate exactly, but write into a
 * reusable object instead of allocating a new one every frame.
 */

/** Earth's circumference at the equator in metres (the value Mapbox uses). */
export const EARTH_CIRCUMFERENCE_M = 40_075_016.686;

export interface MutableMercator {
  x: number;
  y: number;
}

/** Longitude (degrees) → mercator x in [0, 1]. */
export function mercatorX(lng: number): number {
  return (180 + lng) / 360;
}

/** Latitude (degrees) → mercator y in [0, 1] (0 = far north, 1 = far south). */
export function mercatorY(lat: number): number {
  return (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360;
}

/** How many mercator units one metre is, at a given latitude (things stretch near the poles). */
export function meterInMercatorUnits(lat: number): number {
  return 1 / EARTH_CIRCUMFERENCE_M / Math.cos((lat * Math.PI) / 180);
}

/**
 * How many real-world metres one screen pixel covers at a zoom level.
 * Mapbox uses 512-pixel tiles, so the world is 512 × 2^zoom pixels wide.
 */
export function metersPerPixel(zoom: number, lat: number): number {
  return (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
}
