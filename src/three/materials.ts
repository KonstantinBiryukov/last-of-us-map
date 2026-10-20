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
  // Tess: light tan jacket, dark jeans, dark-brown hair tied back.
  tessJacket: 0x9a7b55,
  tessPants: 0x343a46,
  tessHair: 0x2e2420,
  // Bill: stocky, olive-drab work jacket, brown trousers, greying short hair and stubble.
  billJacket: 0x505438,
  billPants: 0x4a3b2c,
  billHair: 0x76706a,
  skinBill: 0xc4937a,
  // Henry and his younger brother Sam: darker skin, black hair; Henry in a grey-blue
  // jacket and khaki trousers, Sam in a blue hoodie.
  skinDark: 0x6e4a35,
  henryJacket: 0x4c5865,
  henryPants: 0x6b5f4a,
  samHoodie: 0x3f6d8c,
  samPants: 0x3a4250,
  darkHair: 0x16110e,
  // Tommy: Joel's brother — brown work jacket, darker trousers, longer brown hair, beard.
  tommyJacket: 0x6b4a2e,
  tommyPants: 0x38383a,
  tommyHair: 0x4a3626,
  // Ellie's bow: a light, honey-coloured wood that stands out against snow and dark forest.
  bowWood: 0xb08453,
  // Marlene: the Fireflies' leader — an olive field jacket, dark khaki trousers.
  marleneJacket: 0x5b5a3c,
  marlenePants: 0x3b382c,
  // Maria: Tommy's wife — dark hair tied back, a muted teal jacket, dark trousers.
  mariaJacket: 0x4d6a64,
  mariaPants: 0x2f3338,
  mariaHair: 0x2a1d16,
  // David: sheepskin-brown coat, dark trousers, grey hair and beard.
  davidCoat: 0x7a5a3a,
  davidPants: 0x3a332c,
  davidHair: 0x8a8580,
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
  // Key-point props (models/props.ts): weathered, muted building materials and nature.
  groundPad: 0x3b342b,
  concrete: 0x8c8981,
  concreteDark: 0x5f5d58,
  brick: 0x7a4636,
  plaster: 0xb5a687,
  roofDark: 0x3e3531,
  roofRed: 0x6c3026,
  wood: 0x6e5137,
  woodDark: 0x4a3726,
  leaf: 0x48623a,
  leafDark: 0x2f4527,
  // Snow on the ground (The Hunt, in Lakeside Resort's winter): bright, slightly cool white.
  snow: 0xe9eef2,
  // Autumn leaves (Fort Collins): a bright orange crown and a deeper orange top.
  leafAutumn: 0xd2752a,
  leafAutumnDark: 0xa94e1c,
  trunk: 0x4b3624,
  stone: 0x9b978c,
  metal: 0x6b6f73,
  rust: 0x7b4b2b,
  containerRed: 0x8a3b2b,
  containerBlue: 0x3d5c7a,
  containerGreen: 0x4e6b3b,
  water: 0x3c6a87,
  signGreen: 0x2f6b46,
  offWhite: 0xd6d1c4,
  crossRed: 0xb02a22,
  asphalt: 0x3b3b3d,
  windowDark: 0x22262b,
  giraffeTan: 0xc79d58,
  giraffeSpot: 0x7a4e2a,
  gold: 0xc9a13b,
  bridgeYellow: 0xd9a21e,
  // The pallet raft at Tommy's dam: weathered, sun-bleached pallet wood on murky water.
  palletWood: 0x9c8058,
  palletWoodLight: 0xb59c74,
  palletWoodDark: 0x5e4a33,
  waterDark: 0x2c4350,
  // Silver Lake's animals.
  deerBrown: 0x8b6a45,
  deerBelly: 0xc9b08a,
  antler: 0xd8ccb0,
  rabbitGrey: 0x9a9088,
  // The rotten boat by the sewer: soaked, blackened planks and slimy weed.
  rottenWood: 0x3f3324,
  // The beached boat in the Suburbs: faded marine blue, on a sandy bank.
  boatBlue: 0x3e5fa8,
  // The decayed school buses (Bus Depot): faded yellow and a darker roof.
  busYellow: 0xc79a3c,
  busYellowDark: 0x9c7a34,
  mud: 0x5a5a34, // the green, weedy mud it is stuck in
  mudDark: 0x404426,
  sand: 0xb9a97f,
  seaweed: 0x3e5a2a,
  // The burning house in Bluff Springs (south Austin): charred walls and glowing flames (emissive, see material()).
  charred: 0x2b2622,
  fireOrange: 0xff6a1a,
  fireYellow: 0xffc23d,
  smoke: 0x3d3833,
  // The old theatre (Buda): red and white neon and lit windows.
  neonRed: 0xff3b2a,
  neonWhite: 0xfff1d6,
  windowLit: 0xffc77a,
} as const;

export type PaletteKey = keyof typeof PALETTE;

const cache = new Map<PaletteKey, THREE.MeshLambertMaterial>();

/** Returns the shared material for a palette colour (created on first use). */
export function material(key: PaletteKey): THREE.MeshLambertMaterial {
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: PALETTE[key], flatShading: true });
    if (key === 'headlight' || key === 'fireOrange' || key === 'fireYellow' || key === 'neonRed' || key === 'neonWhite' || key === 'windowLit') {
      // Light sources glow by themselves (emissive): headlights and the flames in Bluff Springs.
      m.emissive = new THREE.Color(PALETTE[key]);
      m.emissiveIntensity = key === 'headlight' ? 1.2 : 1.6;
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
