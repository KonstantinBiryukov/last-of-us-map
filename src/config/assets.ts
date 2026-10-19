/**
 * assets.ts — turns data paths like "server/assets/…" into real URLs.
 *
 * WHY THIS EXISTS: the site lives at /last-of-us-map/ on GitHub Pages, not at
 * the domain root. A path such as "/server/assets/a.jpg" (leading slash) would
 * point to konstantinbiryukov.github.io/server/… and break. Vite exposes the
 * configured base path as import.meta.env.BASE_URL ("/last-of-us-map/"), so we
 * always glue that in front. Every image/audio/data URL in the app goes
 * through `assetUrl()`.
 */
import manifestJson from '../data/generated/imageManifest.json';

/** Base path from vite.config.ts, always ending with "/". */
const BASE = import.meta.env.BASE_URL;

/** "server/assets/x.jpg" → "/last-of-us-map/server/assets/x.jpg". */
export function assetUrl(path: string): string {
  return BASE + path.replace(/^\/+/, '');
}

/** Information the optimisation script recorded about one image. */
export interface OptimizedImage {
  /** URL of the best file to show (optimized WebP, or the original if not optimized). */
  src: string;
  /** Natural size in pixels, if known (used to reserve space before loading). */
  width: number | undefined;
  height: number | undefined;
  /** Tiny blurry placeholder as a data: URL, if available. */
  lqip: string | undefined;
}

/** One record of src/data/generated/imageManifest.json (written by scripts/optimize-images.mjs). */
interface ManifestEntry {
  width: number;
  height: number;
  src: string;
  lqip: string;
}

/** The generated manifest, typed: original path → optimized info. */
const manifest = manifestJson as Readonly<Record<string, ManifestEntry>>;

/**
 * Look up the optimized version of an image. If the optimisation script has not
 * been run for it, gracefully fall back to the original file.
 */
export function optimizedImage(path: string): OptimizedImage {
  const entry = manifest[path];
  if (!entry) return { src: assetUrl(path), width: undefined, height: undefined, lqip: undefined };
  return { src: assetUrl(entry.src), width: entry.width, height: entry.height, lqip: entry.lqip };
}
