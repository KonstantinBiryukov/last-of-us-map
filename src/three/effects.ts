/**
 * effects.ts — the light, restrained visual effects around the travellers.
 *
 *   Trail   – a glowing ribbon that follows the route BEHIND the travellers
 *             and fades out. Colour/width depend on how they travel; during a
 *             jump it becomes the pale tail of a comet.
 *   Comet   – a bright glowing orb that flies along a jump arc (the stretches
 *             with no detailed path), while the travellers themselves fade out.
 *   Dust    – small puffs kicked up by the horse's hooves or the truck's tyres.
 *             Each puff stays where it was born on the map and fades.
 *   Beacon  – a rippling glow on the ground at the next destination.
 *   Shadow  – a blurred dark disc under the travellers so they feel grounded.
 * (Seasonal particles such as snow and leaves live in ambience.ts.)
 *
 * All effects use tiny custom shaders (small programs that run on the graphics
 * card) with additive or alpha blending, have a fixed number of vertices, and
 * reuse their GPU buffers every frame (they only rewrite a few numbers) — so
 * they cost almost nothing.
 *
 * Coordinates: everything here is in the "local" frame of the 3D layer, where
 * x = metres east, y = metres up, z = metres SOUTH of the travellers.
 *
 * GLSL quick reference for the shader strings below:
 *   attribute – a value per vertex (from a buffer)
 *   uniform   – one value for the whole draw call (set from JavaScript)
 *   varying   – passed from the vertex shader to the fragment (pixel) shader
 *   smoothstep(a, b, x) – 0 below a, 1 above b, a smooth S-curve in between
 */
import * as THREE from 'three';
import type { TravelMode } from '../data/types';

// ───────────────────────── Trail ─────────────────────────

/** Number of points along the trail's centre line (more = smoother curves). */
export const TRAIL_POINTS = 64;

const trailVertex = /* glsl */ `
  attribute float aFade;     // 1 at the travellers, 0 at the far end of the trail
  attribute float aSide;     // -1 on the left edge of the ribbon, +1 on the right edge
  varying float vFade;
  varying float vSide;
  void main() {
    vFade = aFade;
    vSide = aSide;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const trailFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;
  varying float vSide;
  void main() {
    float edge = 1.0 - smoothstep(0.35, 1.0, abs(vSide)); // bright core, soft edges
    float alpha = edge * vFade * vFade * uOpacity;         // fade² = quick fade towards the tail
    gl_FragColor = vec4(uColor * (0.6 + 0.8 * edge), alpha);
  }
`;

/** Look of the trail for each travel mode. Sizes are in screen pixels (converted to metres each frame). */
export const TRAIL_STYLE: Record<TravelMode | 'jump', { color: number; widthPx: number; lengthPx: number }> = {
  walk: { color: 0xffc56b, widthPx: 7, lengthPx: 240 }, // warm lantern amber, narrow
  horse: { color: 0xffe2a6, widthPx: 9, lengthPx: 340 }, // pale gold, longer stride
  vehicle: { color: 0xff8a5b, widthPx: 10, lengthPx: 400 }, // ember red-orange, wide
  jump: { color: 0xd9ecff, widthPx: 6, lengthPx: 520 }, // cool white comet tail
};

/**
 * A ribbon (a long strip of triangles) laid along the route behind the travellers.
 *
 * Geometry: for every centre-line point i we create TWO vertices, one on each
 * side of the line (2i = left, 2i+1 = right). Neighbouring pairs form two
 * triangles each — a "triangle strip" drawn with an index list.
 */
export class Trail {
  readonly mesh: THREE.Mesh;
  /** Vertex positions, rewritten every frame: [x, y, z] × 2 per centre point. */
  private readonly positions: Float32Array;
  private readonly material: THREE.ShaderMaterial;
  private readonly geometry: THREE.BufferGeometry;

  constructor() {
    const n = TRAIL_POINTS;
    this.positions = new Float32Array(n * 2 * 3);
    const fade = new Float32Array(n * 2); // per-vertex "how far along the tail"
    const side = new Float32Array(n * 2); // per-vertex "left or right edge"
    const index: number[] = [];
    for (let i = 0; i < n; i++) {
      const f = 1 - i / (n - 1);
      fade[i * 2] = f;
      fade[i * 2 + 1] = f;
      side[i * 2] = -1;
      side[i * 2 + 1] = 1;
      if (i < n - 1) {
        const a = i * 2; // left vertex of this pair; a+1 right, a+2/a+3 the next pair
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    this.geometry = new THREE.BufferGeometry();
    // DynamicDrawUsage tells the GPU driver this buffer changes often (it may store it differently).
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aFade', new THREE.BufferAttribute(fade, 1));
    this.geometry.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    this.geometry.setIndex(index);
    this.material = new THREE.ShaderMaterial({
      vertexShader: trailVertex,
      fragmentShader: trailFragment,
      uniforms: { uColor: { value: new THREE.Color(0xffc56b) }, uOpacity: { value: 0.9 } },
      transparent: true,
      depthWrite: false, // a glow must not hide what is behind it
      depthTest: false, // …and must not be cut by hills when terrain is on
      blending: THREE.AdditiveBlending, // adds light: overlapping glows get brighter
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false; // the map supplies the projection; Three's culling would be wrong
    this.mesh.renderOrder = 1;
  }

  /**
   * Rebuilds the ribbon from centre-line points.
   * @param centre x, z pairs in local metres; index 0 = at the travellers
   * @param count  how many pairs in `centre` are valid
   * @param width  ribbon width in metres
   * @param height how high above the ground (metres)
   */
  update(centre: Float64Array, count: number, width: number, height: number): void {
    const p = this.positions;
    const half = width / 2;
    for (let i = 0; i < TRAIL_POINTS; i++) {
      const j = Math.min(i, count - 1);
      const x = centre[j * 2]!;
      const z = centre[j * 2 + 1]!;
      // Direction along the trail (from the neighbour points) …
      const jPrev = Math.max(0, j - 1);
      const jNext = Math.min(count - 1, j + 1);
      let dx = centre[jNext * 2]! - centre[jPrev * 2]!;
      let dz = centre[jNext * 2 + 1]! - centre[jPrev * 2 + 1]!;
      const len = Math.hypot(dx, dz) || 1; // `|| 1` avoids dividing by zero on a zero-length piece
      dx /= len;
      dz /= len;
      // … rotated 90° gives the sideways direction for the ribbon's width.
      const nx = -dz * half;
      const nz = dx * half;
      p[i * 6] = x + nx;
      p[i * 6 + 1] = height;
      p[i * 6 + 2] = z + nz;
      p[i * 6 + 3] = x - nx;
      p[i * 6 + 4] = height;
      p[i * 6 + 5] = z - nz;
    }
    // Tell Three.js to re-upload the changed buffer to the GPU before the next draw.
    (this.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  /** Changes the colour and opacity (cheap: two uniforms). */
  setStyle(color: number, opacity: number): void {
    (this.material.uniforms['uColor']!.value as THREE.Color).setHex(color);
    this.material.uniforms['uOpacity']!.value = opacity;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

// ───────────────────────── Shared round "soft dot" sprite texture ─────────────────────────

/** Draws a radial gradient on a small canvas: a soft dot used by dust and the shadow. */
function makeDotTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Creates the shared soft-dot texture (call once; dispose it with the layer). */
export function createSharedTexture(): THREE.Texture {
  return makeDotTexture();
}

// Points shader shared by dust and the comet: per-particle size (in pixels) and alpha.
const pointsVertex = /* glsl */ `
  attribute float aSize;     // size in CSS pixels
  attribute float aAlpha;    // opacity 0..1
  varying float vAlpha;
  uniform float uPixelRatio; // device pixels per CSS pixel (2 on Retina)
  void main() {
    vAlpha = aAlpha;
    gl_PointSize = aSize * uPixelRatio;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const pointsFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord); // gl_PointCoord = 0..1 across the sprite
    gl_FragColor = vec4(uColor, tex.a * vAlpha);
  }
`;

/** A fixed-size cloud of point sprites whose positions/sizes/alphas we rewrite each frame. */
class PointCloud {
  readonly points: THREE.Points;
  readonly positions: Float32Array;
  readonly sizes: Float32Array;
  readonly alphas: Float32Array;
  readonly material: THREE.ShaderMaterial;
  private readonly geometry: THREE.BufferGeometry;

  constructor(count: number, texture: THREE.Texture, color: number, additive: boolean) {
    this.positions = new Float32Array(count * 3);
    this.sizes = new Float32Array(count);
    this.alphas = new Float32Array(count);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      vertexShader: pointsVertex,
      fragmentShader: pointsFragment,
      uniforms: {
        uMap: { value: texture },
        uColor: { value: new THREE.Color(color) },
        uPixelRatio: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
  }

  /** Marks all three buffers as changed so Three.js uploads them. */
  commit(): void {
    (this.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

// ───────────────────────── Comet (jumps) ─────────────────────────

/**
 * The bright orb that flies along a jump arc: two point sprites drawn at the
 * same spot — a large faint halo and a small bright core.
 */
export class Comet {
  readonly cloud: PointCloud;

  constructor(texture: THREE.Texture) {
    this.cloud = new PointCloud(2, texture, 0xeaf4ff, true);
    this.cloud.sizes[0] = 70; // halo
    this.cloud.sizes[1] = 18; // core
  }

  /**
   * @param visible    0‥1 (0 hides it)
   * @param pulse      story time, makes the halo breathe gently
   * @param pixelRatio device pixel ratio
   */
  update(visible: number, pulse: number, pixelRatio: number): void {
    this.cloud.points.visible = visible > 0.01;
    this.cloud.material.uniforms['uPixelRatio']!.value = pixelRatio;
    // Both sprites sit exactly at the travellers' position (the local origin), slightly above ground.
    for (let i = 0; i < 2; i++) {
      this.cloud.positions[i * 3] = 0;
      this.cloud.positions[i * 3 + 1] = 0;
      this.cloud.positions[i * 3 + 2] = 0;
    }
    this.cloud.alphas[0] = visible * (0.45 + 0.15 * Math.sin(pulse * 6));
    this.cloud.alphas[1] = visible;
    this.cloud.commit();
  }

  dispose(): void {
    this.cloud.dispose();
  }
}

// ───────────────────────── Dust ─────────────────────────

/** Maximum number of puffs alive at once (old ones are recycled in a ring). */
const DUST_COUNT = 48;
/** How long a puff lives, in seconds of STORY time. */
const DUST_LIFETIME = 1.4;

/**
 * Dust puffs. Each puff remembers its birth place in MERCATOR coordinates
 * (absolute map position, stored in 64-bit floats for precision) so it stays
 * put on the map while the travellers move on. Ages advance with STORY time,
 * so dust freezes when the story is paused.
 */
export class Dust {
  readonly cloud: PointCloud;
  /** Birth position of each puff (mercator x/y). */
  private readonly bornX = new Float64Array(DUST_COUNT);
  private readonly bornY = new Float64Array(DUST_COUNT);
  /** Age of each puff in seconds; starts "dead" (= lifetime). */
  private readonly age = new Float32Array(DUST_COUNT).fill(DUST_LIFETIME);
  /** Random number per puff (direction of its drift). */
  private readonly seed = new Float32Array(DUST_COUNT);
  /** Which slot the next puff will use (a "ring buffer": wraps back to 0). */
  private next = 0;
  /** Fractional puffs owed: e.g. 14 puffs/s at 60 fps = 0.23 per frame, accumulated until ≥ 1. */
  private spawnAccumulator = 0;

  constructor(texture: THREE.Texture) {
    this.cloud = new PointCloud(DUST_COUNT, texture, 0xc9b49a, false);
    for (let i = 0; i < DUST_COUNT; i++) this.seed[i] = Math.random();
  }

  /** Remove all puffs (after a seek, so dust never appears in the wrong place). */
  reset(): void {
    this.age.fill(DUST_LIFETIME);
    this.spawnAccumulator = 0;
  }

  /**
   * @param dt          story seconds since last frame (0 when paused)
   * @param rate        puffs per second (0 = none)
   * @param anchorX/Y   the travellers' mercator position (where new puffs are born)
   * @param toLocal     metres per mercator unit (converts offsets to local metres)
   * @param pxToMeters  metres per screen pixel (so puffs keep a sensible size on screen)
   */
  update(dt: number, rate: number, anchorX: number, anchorY: number, toLocal: number, pxToMeters: number): void {
    this.spawnAccumulator += dt * rate;
    while (this.spawnAccumulator >= 1) {
      this.spawnAccumulator -= 1;
      const i = this.next;
      this.next = (this.next + 1) % DUST_COUNT;
      this.bornX[i] = anchorX;
      this.bornY[i] = anchorY;
      this.age[i] = 0;
      this.seed[i] = Math.random();
    }
    const c = this.cloud;
    for (let i = 0; i < DUST_COUNT; i++) {
      const age = (this.age[i] = Math.min(DUST_LIFETIME, this.age[i]! + dt));
      const life = age / DUST_LIFETIME; // 0 = just born → 1 = gone
      const s = this.seed[i]!;
      // Offset from the travellers in local metres, plus a little spread sideways and upward.
      const spread = (6 + 18 * life) * pxToMeters;
      c.positions[i * 3] = (this.bornX[i]! - anchorX) * toLocal + Math.cos(s * 6.28) * spread;
      c.positions[i * 3 + 1] = life * 14 * pxToMeters;
      c.positions[i * 3 + 2] = (this.bornY[i]! - anchorY) * toLocal + Math.sin(s * 6.28) * spread;
      c.sizes[i] = 10 + 26 * life; // puffs grow as they disperse
      c.alphas[i] = life >= 1 ? 0 : (1 - life) * 0.45; // and fade out
    }
    c.commit();
  }

  dispose(): void {
    this.cloud.dispose();
  }
}

// ───────────────────────── Destination beacon ─────────────────────────

const beaconVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv * 2.0 - 1.0; // texture coords 0..1 → -1..1, so the centre is (0, 0)
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const beaconFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float r = length(vUv);          // distance from the centre (0 = middle, 1 = edge)
    if (r > 1.0) discard;           // outside the circle: draw nothing
    // A steady bright core plus two rings that keep expanding outward and fading.
    float core = smoothstep(0.16, 0.0, r);
    float rings = 0.0;
    for (int i = 0; i < 2; i++) {
      float phase = fract(uTime * 0.45 + float(i) * 0.5); // 0→1 repeating; rings half a cycle apart
      float ring = smoothstep(0.08, 0.0, abs(r - phase));  // thin ring at radius = phase
      rings += ring * (1.0 - phase);                       // fade as it grows
    }
    gl_FragColor = vec4(uColor, (core + rings) * uOpacity);
  }
`;

/**
 * Marks the end of the current leg (the next destination) with a soft glowing
 * dot and two rings that ripple outward on the ground — like a signal flare
 * seen from above. It lies flat on the map, so it never hides geography.
 */
export class Beacon {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly geometry: THREE.PlaneGeometry;

  constructor() {
    this.geometry = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2); // flat on the ground
    this.material = new THREE.ShaderMaterial({
      vertexShader: beaconVertex,
      fragmentShader: beaconFragment,
      uniforms: {
        uColor: { value: new THREE.Color(0xffcf7a) },
        uOpacity: { value: 0.8 },
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  /** `radius` in metres; `time` drives the ripple (story time, so it pauses with the story). */
  update(x: number, z: number, radius: number, time: number, opacity: number): void {
    this.mesh.position.set(x, this.mesh.position.y, z);
    this.mesh.scale.set(radius, 1, radius);
    this.material.uniforms['uTime']!.value = time;
    this.material.uniforms['uOpacity']!.value = opacity;
    this.mesh.visible = opacity > 0.01;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

// ───────────────────────── Ground shadow ─────────────────────────

/** A soft dark ellipse under the travellers (a "blob shadow": far cheaper than real shadows). */
export class BlobShadow {
  readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.PlaneGeometry;
  private readonly material: THREE.MeshBasicMaterial;

  constructor(texture: THREE.Texture) {
    this.geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    // `map` supplies the soft alpha gradient; colour × white texture with black colour = black shadow.
    this.material = new THREE.MeshBasicMaterial({
      color: 0x000000,
      map: texture,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.position.y = 0.05; // a hair above the ground so it does not flicker against it
  }

  /** Size of the ellipse in (model) metres. */
  setSize(width: number, length: number): void {
    this.mesh.scale.set(width, 1, length);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
