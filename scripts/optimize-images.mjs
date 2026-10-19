/**
 * optimize-images.mjs — one-off asset pipeline (run with `npm run optimize:images`).
 *
 * WHY: the original slideshow images weigh ~30 MB, and some PNG screenshots are
 * 2400 px wide and 2 MB each. Shipping those makes every slide change slow.
 *
 * WHAT IT DOES, for every image the app shows:
 *   1. Leaves the ORIGINAL file untouched (nothing is deleted).
 *   2. Writes a resized WebP copy under public/server/optimized/… (same folder
 *      structure, same file name, `.webp` extension).
 *   3. Measures the real width/height so the UI can reserve the exact space
 *      before the image loads (no layout shift).
 *   4. Creates a tiny 24 px "blurry preview" (LQIP = Low Quality Image
 *      Placeholder), encoded as a data: URL, shown while the real image loads.
 *
 * All of that is written to src/data/generated/imageManifest.json, which the
 * app imports. If an image is missing from the manifest, the app simply falls
 * back to the original file — so forgetting to re-run this script never breaks
 * anything, it just makes it slower.
 */
import { readdir, mkdir, writeFile, stat } from 'node:fs/promises';
import { join, relative, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const assetsDir = join(publicDir, 'server', 'assets');
const outDir = join(publicDir, 'server', 'optimized');
const manifestPath = join(root, 'src', 'data', 'generated', 'imageManifest.json');

/** Which folders to process and how wide their optimized copies may be. */
const groups = [
  { folder: 'story_telling_images', maxWidth: 1600, quality: 78 },
  { folder: 'card_images', maxWidth: 1280, quality: 78 },
  { folder: 'large_images', maxWidth: 1920, quality: 80 },
  { folder: 'marker_icons', maxWidth: 160, quality: 85 },
];

const imageExtensions = new Set(['.png', '.jpg', '.jpeg']);

/** Recursively list every image file inside a folder. */
async function listImages(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listImages(full)));
    else if (imageExtensions.has(extname(entry.name).toLowerCase())) files.push(full);
  }
  return files;
}

const manifest = {};
let originalBytes = 0;
let optimizedBytes = 0;

for (const group of groups) {
  const files = await listImages(join(assetsDir, group.folder));
  for (const file of files) {
    // Paths in the manifest are relative to /public, exactly as the app refers to them.
    const publicPath = relative(publicDir, file).split('\\').join('/');
    const outFile = join(outDir, relative(assetsDir, file)).replace(/\.(png|jpe?g)$/i, '.webp');
    await mkdir(dirname(outFile), { recursive: true });

    const image = sharp(file);
    const meta = await image.metadata();

    // 1) Resized WebP copy (never upscale small images).
    const info = await image
      .clone()
      .resize({ width: group.maxWidth, withoutEnlargement: true })
      .webp({ quality: group.quality })
      .toFile(outFile);

    // 2) Tiny blurry placeholder.
    const lqipBuffer = await image.clone().resize({ width: 24 }).webp({ quality: 40 }).toBuffer();

    manifest[publicPath] = {
      width: meta.width,
      height: meta.height,
      src: relative(publicDir, outFile).split('\\').join('/'),
      lqip: `data:image/webp;base64,${lqipBuffer.toString('base64')}`,
    };

    originalBytes += (await stat(file)).size;
    optimizedBytes += info.size;
  }
}

await mkdir(dirname(manifestPath), { recursive: true });
await writeFile(manifestPath, JSON.stringify(manifest, null, 1) + '\n');

const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB';
console.log(
  `Optimized ${Object.keys(manifest).length} images: ${mb(originalBytes)} -> ${mb(optimizedBytes)}`,
);
