/**
 * followZoom.ts — the zoom the follow camera uses for each travelled part (leg span).
 *
 * The camera picks, per part, the zoom at which the travellers move across the screen at a
 * comfortable speed (about 28 px per second): close in for a slow walk through a city,
 * far out for a long ride. Maths:
 *     pixels/second = (metres/second) ÷ (metres per pixel at that zoom), and
 *     metresPerPixel(z) = C·cos(lat) / (512·2^z)        (C = Earth's circumference)
 * Solving for z:
 *     z = log2( C·cos(lat)·pixelsPerSecond / (512·metresPerSecond) )
 *
 * Shared by the camera (map/camera.ts) and the key-point props (three/keyPoints.ts),
 * which are sized to match the travellers at exactly that zoom.
 */
import type { LegSpan } from './timeline';

/** Comfortable on-screen speed of the travellers, in pixels per second. */
export const TARGET_SCREEN_SPEED_PX = 28;
/**
 * Zoom limits while following (4 ≈ several states visible, 15.5 ≈ city blocks).
 * The upper limit matters for slow city walks (Boston, Lincoln): with a cap of 11.5 a
 * walk of a few blocks moved only ~4 px per second on screen, which looked like walking
 * on the spot. At street level the same walk visibly crosses the city.
 */
export const MIN_FOLLOW_ZOOM = 4.2;
export const MAX_FOLLOW_ZOOM = 15.5;

/**
 * The follow camera's zoom for a travelled (non-jump) span at latitude `lat`, including the
 * span's own camera adjustment (`camera.zoom` in data/chapters.ts, e.g. +1 = closer).
 */
export function comfortableZoom(span: LegSpan, lat: number): number {
  const metres = span.endDistance - span.startDistance;
  const seconds = Math.max(span.end - span.start, 0.1);
  const speed = Math.max(metres / seconds, 1);
  const z = Math.log2((40_075_016.686 * Math.cos((lat * Math.PI) / 180) * TARGET_SCREEN_SPEED_PX) / (512 * speed));
  return Math.min(MAX_FOLLOW_ZOOM, Math.max(MIN_FOLLOW_ZOOM, z)) + (span.camera.zoom ?? 0);
}
