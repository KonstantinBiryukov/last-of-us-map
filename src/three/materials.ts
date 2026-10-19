/**
 * materials.ts — one shared palette of Three.js materials.
 *
 * Creating a material compiles a GPU program, which is slow. So every colour
 * is created ONCE here and reused by all models (Joel, Ellie, horse, truck).
 * `disposeMaterials()` frees them all when the 3D layer is removed.
 *
 * We use MeshLambertMaterial with flat shading: it is cheap (no reflections),
 * gives the faceted "low-poly" look, and — importantly for a map overlay — does
 * not depend on the camera position, which is unusual inside Mapbox.
 */
import * as THREE from 'three';

/** Colours chosen to echo the characters' recognisable outfits in muted, game-like tones. */
export const PALETTE = {
  skin: 0xc99a7b,
  skinEllie: 0xdcae92,
  // Joel: dark, worn denim-blue shirt, dark jeans, brown boots, greying dark-brown hair/beard.
  joelShirt: 0x4b5d70,
  joelPants: 0x2e3440,
  joelHair: 0x3b2f2a,
  // Ellie: olive t-shirt, blue jeans, auburn hair in a ponytail.
  ellieShirt: 0x6b7350,
  elliePants: 0x3f526b,
  ellieHair: 0x7a3b22,
  boots: 0x3a2a1e,
  backpack: 0x6e5a3c,
  strap: 0x2b2118,
  // Horse: chestnut coat, dark mane, black hooves, leather saddle.
  horseCoat: 0x7b4a2a,
  horseMane: 0x2a1a12,
  hoof: 0x1d1612,
  saddle: 0x4a2f1c,
  // Truck: weathered faded red paint, rusty dark trim, black tyres.
  truckPaint: 0x7d3328,
  truckTrim: 0x2b2826,
  glass: 0x1c2630,
  tyre: 0x151515,
  hubcap: 0x8f8a82,
  headlight: 0xffe7b0,
} as const;

export type PaletteKey = keyof typeof PALETTE;

const cache = new Map<PaletteKey, THREE.MeshLambertMaterial>();

/** Returns the shared material for a palette colour (created on first use). */
export function material(key: PaletteKey): THREE.MeshLambertMaterial {
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: PALETTE[key], flatShading: true });
    if (key === 'headlight') {
      m.emissive = new THREE.Color(PALETTE.headlight);
      m.emissiveIntensity = 1.2;
    }
    cache.set(key, m);
  }
  return m;
}

export function disposeMaterials(): void {
  for (const m of cache.values()) m.dispose();
  cache.clear();
}

/** Shared geometries, also created once. Keys describe the shape. */
const geometryCache = new Map<string, THREE.BufferGeometry>();

export function sharedGeometry(key: string, create: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geometryCache.get(key);
  if (!g) {
    g = create();
    geometryCache.set(key, g);
  }
  return g;
}

export function disposeGeometries(): void {
  for (const g of geometryCache.values()) g.dispose();
  geometryCache.clear();
}

/** Small helper: a mesh with a shared geometry + material, already positioned. */
export function part(
  geometryKey: string,
  createGeometry: () => THREE.BufferGeometry,
  materialKey: PaletteKey,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(sharedGeometry(geometryKey, createGeometry), material(materialKey));
  mesh.position.set(x, y, z);
  // The map supplies its own projection, so Three's automatic visibility culling would be wrong.
  mesh.frustumCulled = false;
  return mesh;
}
