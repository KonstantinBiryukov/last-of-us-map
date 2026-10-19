/**
 * ambience.ts — atmospheric particles (snow, leaves, embers, fireflies…),
 * animated ENTIRELY on the graphics card.
 *
 * WHY ON THE GPU
 * The old version moved every particle in JavaScript each frame and re-uploaded
 * the positions. Here each particle only gets four random numbers ONCE, at
 * start-up (its "seed"). The vertex shader — a tiny program the GPU runs for
 * every particle, every frame, in parallel — computes the position from
 *     seed + time × velocity + a little sway
 * So per frame the CPU only updates a handful of uniforms (time, box size…),
 * no matter how many particles there are. Hundreds of particles cost ~nothing.
 *
 * THE "WEATHER BOX" TRICK
 * Particles live inside an invisible box centred on the travellers (it moves
 * with them). Positions inside the box are fractions 0‥1 that wrap around with
 * `fract()` (keeps only the part after the decimal point: fract(1.3) = 0.3), so
 * a snowflake leaving the bottom re-enters at the top — an endless snowfall from
 * a fixed number of particles. To make the weather feel fixed to the WORLD
 * rather than glued to the travellers, we subtract the travellers' world
 * position (also as a box fraction, `uOffset`) — when they walk east, the flakes
 * drift west relative to them, exactly like real weather they move through.
 * Near the box walls particles fade out, so the wrap-around is invisible.
 *
 * Each AmbienceKind is a "recipe" (count, colours, speed, shape, size). A
 * chapter lists one or two kinds; only those are drawn.
 */
import * as THREE from 'three';
import type { AmbienceKind } from '../data/types';

/** Particle shapes understood by the fragment shader (the number is passed to the GPU). */
const SHAPE = { glow: 0, leaf: 1, flake: 2, smoke: 3, petal: 4 } as const;

interface Recipe {
  /** How many particles. */
  count: number;
  /** Two colours; each particle gets a random mix of them. */
  colorA: number;
  colorB: number;
  /** Drift in "box sizes per second" along x (east), y (up), z (south). Negative y = falling. */
  velocity: [number, number, number];
  /** Side-to-side wobble amplitude (box fractions). */
  sway: number;
  /** Point size in CSS pixels (randomised ±40 %). */
  size: number;
  /** Which drawing (see SHAPE). */
  shape: number;
  /** 0 = steady, 1 = blinks/flickers fully. */
  twinkle: number;
  /** Blink speed (radians per second). */
  twinkleSpeed: number;
  /** How fast shapes spin (leaves and petals tumble). */
  spin: number;
  /** Overall opacity. */
  opacity: number;
  /** Additive blending makes things glow (lights); normal blending for solid things (leaves, snow). */
  additive: boolean;
  /**
   * Box height as a fraction of the box width. Kept small on purpose: with the
   * camera tilted, particles high above the ground would be projected far up the
   * screen (or behind the camera), so the weather lives in a thin layer near the ground.
   */
  height: number;
}

const RECIPES: Record<AmbienceKind, Recipe> = {
  // Glowing sparks rising and flickering above burning Austin.
  embers: { count: 220, colorA: 0xff6a1f, colorB: 0xffc35a, velocity: [0.012, 0.09, 0.004], sway: 0.03, size: 6, shape: SHAPE.glow, twinkle: 0.8, twinkleSpeed: 9, spin: 0, opacity: 0.95, additive: true, height: 0.16 },
  // Large soft dark puffs drifting with the wind.
  smoke: { count: 26, colorA: 0x2b2622, colorB: 0x4a403a, velocity: [0.02, 0.025, 0.006], sway: 0.02, size: 120, shape: SHAPE.smoke, twinkle: 0, twinkleSpeed: 0, spin: 0.2, opacity: 0.35, additive: false, height: 0.12 },
  // Warm specks floating lazily in sunlight.
  dust: { count: 220, colorA: 0xf3d9a4, colorB: 0xfff3d6, velocity: [0.006, 0.004, 0.003], sway: 0.05, size: 3.5, shape: SHAPE.glow, twinkle: 0.4, twinkleSpeed: 1.3, spin: 0, opacity: 0.55, additive: true, height: 0.1 },
  // Cordyceps spores: pale green-yellow, slow, swirling.
  spores: { count: 200, colorA: 0xc9e07a, colorB: 0xe9f2b0, velocity: [0.003, 0.012, 0.002], sway: 0.08, size: 5, shape: SHAPE.glow, twinkle: 0.3, twinkleSpeed: 0.9, spin: 0, opacity: 0.6, additive: true, height: 0.1 },
  // Fireflies: wander, blink slowly on and off.
  fireflies: { count: 150, colorA: 0xd8ff6a, colorB: 0xfff0a0, velocity: [0.002, 0.003, 0.002], sway: 0.12, size: 9, shape: SHAPE.glow, twinkle: 1, twinkleSpeed: 1.7, spin: 0, opacity: 1, additive: true, height: 0.06 },
  // Autumn leaves: tumble and flip as they fall.
  leaves: { count: 180, colorA: 0xc4511d, colorB: 0xe8a531, velocity: [0.02, -0.05, 0.008], sway: 0.06, size: 13, shape: SHAPE.leaf, twinkle: 0, twinkleSpeed: 0, spin: 2.5, opacity: 0.95, additive: false, height: 0.15 },
  // Snow: many flakes falling and drifting with the wind.
  snow: { count: 800, colorA: 0xf4f7ff, colorB: 0xd9e4f5, velocity: [0.018, -0.07, 0.006], sway: 0.025, size: 7, shape: SHAPE.flake, twinkle: 0.15, twinkleSpeed: 3, spin: 0, opacity: 0.9, additive: false, height: 0.2 },
  // Spring pollen: tiny bright specks drifting gently upward.
  pollen: { count: 240, colorA: 0xfff1a8, colorB: 0xffffff, velocity: [0.008, 0.01, 0.004], sway: 0.06, size: 3, shape: SHAPE.glow, twinkle: 0.5, twinkleSpeed: 2.2, spin: 0, opacity: 0.7, additive: true, height: 0.1 },
  // Pale blossom petals fluttering down.
  petals: { count: 150, colorA: 0xf6c9d4, colorB: 0xfff4f4, velocity: [0.015, -0.03, 0.006], sway: 0.07, size: 9, shape: SHAPE.petal, twinkle: 0, twinkleSpeed: 0, spin: 1.8, opacity: 0.9, additive: false, height: 0.12 },
};

// ───────────────────────── shaders ─────────────────────────

const vertexShader = /* glsl */ `
  attribute vec4 aSeed;        // four random numbers in 0..1, fixed per particle

  uniform float uTime;         // seconds (wall clock)
  uniform float uBox;          // box width in metres
  uniform float uHeight;       // box height in metres
  uniform vec2  uOffset;       // travellers' world position as a box fraction (x east, y south)
  uniform vec3  uVelocity;     // drift in box sizes per second
  uniform float uSway;
  uniform float uSize;         // point size in CSS pixels
  uniform float uPixelRatio;   // device pixels per CSS pixel (2 on Retina screens)
  uniform float uTwinkle;
  uniform float uTwinkleSpeed;
  uniform float uSpin;
  uniform float uIntensity;    // 0..1 overall fade (zoomed-out views, settings)

  varying float vAlpha;
  varying float vRotation;
  varying float vMix;          // which mix of colorA/colorB
  varying float vFlip;         // fake 3D flip for leaves and petals

  void main() {
    float speed = 0.6 + 0.8 * aSeed.w;            // every particle moves at its own pace
    float t = uTime * speed;
    vec3 p = aSeed.xyz + uVelocity * t;            // straight drift…
    p.x += sin(t * 0.9 + aSeed.w * 40.0) * uSway; // …plus a lazy wobble
    p.z += cos(t * 0.7 + aSeed.x * 30.0) * uSway;
    p.xz -= uOffset;                               // stay fixed to the world (see file header)
    p = fract(p);                                  // wrap around inside the box

    // Fade near every wall of the box so wrapping is invisible.
    float edge = smoothstep(0.0, 0.12, p.x) * smoothstep(1.0, 0.88, p.x)
               * smoothstep(0.0, 0.12, p.z) * smoothstep(1.0, 0.88, p.z)
               * smoothstep(0.0, 0.10, p.y) * smoothstep(1.0, 0.85, p.y);

    vec3 position = vec3((p.x - 0.5) * uBox, p.y * uHeight, (p.z - 0.5) * uBox);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * (0.6 + 0.8 * aSeed.y) * uPixelRatio;

    float blink = 0.5 + 0.5 * sin(uTime * uTwinkleSpeed * (0.7 + aSeed.z) + aSeed.y * 60.0);
    vAlpha = edge * mix(1.0, blink * blink, uTwinkle) * uIntensity;
    vRotation = aSeed.z * 6.2831 + uTime * uSpin * (aSeed.x - 0.5) * 2.0;
    vFlip = abs(sin(uTime * uSpin * 0.8 + aSeed.w * 12.0));
    vMix = aSeed.y;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform float uOpacity;
  uniform int   uShape;

  varying float vAlpha;
  varying float vRotation;
  varying float vMix;
  varying float vFlip;

  void main() {
    // gl_PointCoord runs 0..1 across the square point sprite; centre it and rotate it.
    vec2 uv = gl_PointCoord - 0.5;
    float c = cos(vRotation), s = sin(vRotation);
    uv = mat2(c, -s, s, c) * uv;

    // r = distance from the sprite centre: 0 in the middle, 1 at the edge of the inscribed
    // circle, ~1.41 in the corners. Every shape is multiplied by "round" (0 beyond r = 1),
    // otherwise the soft halo would end abruptly at the square sprite's border and each
    // particle would show up as a faint square.
    float r = length(uv) * 2.0;
    float round = smoothstep(1.0, 0.75, r);
    float alpha;
    if (uShape == 0) {                 // glow: bright core, soft halo
      alpha = exp(-r * r * 4.0) + 0.25 * exp(-r * r * 0.9);
    } else if (uShape == 1) {          // leaf: pointed oval that "flips" (squashes) as it tumbles
      uv.x /= max(vFlip, 0.15);
      float d = length(vec2(uv.x * 2.4, uv.y * 1.3 + uv.x * uv.x * 2.0));
      alpha = smoothstep(0.5, 0.42, d);
      alpha *= 1.0 - 0.35 * smoothstep(0.03, 0.0, abs(uv.x)); // darker centre vein
    } else if (uShape == 2) {          // snowflake: soft disc with a faint sparkle cross
      alpha = smoothstep(1.0, 0.45, r) + 0.4 * smoothstep(0.08, 0.0, min(abs(uv.x), abs(uv.y))) * smoothstep(1.0, 0.0, r);
    } else if (uShape == 3) {          // smoke: very soft blob
      alpha = smoothstep(1.0, 0.0, r);
      alpha *= alpha;
    } else {                           // petal: round-ended oval, flipping
      uv.x /= max(vFlip, 0.2);
      float d = length(vec2(uv.x * 2.0, uv.y * 3.2));
      alpha = smoothstep(0.5, 0.4, d);
    }
    float a = alpha * round * vAlpha * uOpacity;
    if (a < 0.01) discard;             // skip invisible pixels entirely (saves blending work)
    gl_FragColor = vec4(mix(uColorA, uColorB, vMix), a);
  }
`;

/** One particle system (one AmbienceKind). */
class ParticleLayer {
  readonly points: THREE.Points;
  readonly material: THREE.ShaderMaterial;
  readonly recipe: Recipe;
  private readonly geometry: THREE.BufferGeometry;

  constructor(recipe: Recipe) {
    this.recipe = recipe;
    const seeds = new Float32Array(recipe.count * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    // Three.js requires a `position` attribute to know how many points to draw; the shader ignores it.
    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(recipe.count * 3), 3));
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uBox: { value: 1000 },
        uHeight: { value: 500 },
        uOffset: { value: new THREE.Vector2() },
        uVelocity: { value: new THREE.Vector3(...recipe.velocity) },
        uSway: { value: recipe.sway },
        uSize: { value: recipe.size },
        uPixelRatio: { value: 1 },
        uTwinkle: { value: recipe.twinkle },
        uTwinkleSpeed: { value: recipe.twinkleSpeed },
        uSpin: { value: recipe.spin },
        uIntensity: { value: 1 },
        uColorA: { value: new THREE.Color(recipe.colorA) },
        uColorB: { value: new THREE.Color(recipe.colorB) },
        uOpacity: { value: recipe.opacity },
        uShape: { value: recipe.shape },
      },
      transparent: true,
      depthWrite: false, // particles never hide each other or the models behind them
      blending: recipe.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false; // the map supplies the projection; Three's culling would be wrong
    this.points.renderOrder = 3;
    this.points.visible = false;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

/** Parameters for one frame. */
export interface AmbienceFrame {
  /** The kinds to show (from the current chapter). */
  kinds: readonly AmbienceKind[];
  /** Wall-clock seconds (keeps drifting even when the story is paused — it is just atmosphere). */
  time: number;
  /** Metres per screen pixel at the travellers (decides the box size). */
  metersPerPixel: number;
  /** Travellers' world position in metres (east, south) — large numbers, kept in float64 here. */
  worldX: number;
  worldY: number;
  /** 0‥1 overall strength. */
  intensity: number;
  pixelRatio: number;
}

/** All particle systems; creates each kind the first time it is needed. */
export class Ambience {
  readonly group = new THREE.Group();
  private layers = new Map<AmbienceKind, ParticleLayer>();

  update(frame: AmbienceFrame): void {
    // Box size snapped to a power of two of the pixel size: it only changes when the zoom
    // crosses a whole level, so particles do not reshuffle continuously while zooming.
    const box = 2 ** Math.round(Math.log2(frame.metersPerPixel * 1400));
    // Fraction of the box the travellers have moved (float64 maths on the CPU, then a small
    // number goes to the GPU — GPUs only have float32, which could not hold ~10 000 km precisely).
    const offsetX = fract(frame.worldX / box);
    const offsetY = fract(frame.worldY / box);

    for (const [kind, layer] of this.layers) layer.points.visible = frame.intensity > 0 && frame.kinds.includes(kind);
    if (frame.intensity <= 0) return;

    for (const kind of frame.kinds) {
      let layer = this.layers.get(kind);
      if (!layer) {
        layer = new ParticleLayer(RECIPES[kind]);
        this.layers.set(kind, layer);
        this.group.add(layer.points);
      }
      layer.points.visible = true;
      const u = layer.material.uniforms;
      u['uTime']!.value = frame.time;
      u['uBox']!.value = box;
      u['uHeight']!.value = box * layer.recipe.height;
      (u['uOffset']!.value as THREE.Vector2).set(offsetX, offsetY);
      u['uPixelRatio']!.value = frame.pixelRatio;
      u['uIntensity']!.value = frame.intensity;
    }
  }

  dispose(): void {
    for (const layer of this.layers.values()) layer.dispose();
    this.layers.clear();
    this.group.clear();
  }
}

/** Fractional part, always 0‥1 (also for negative numbers, unlike `x % 1`). */
function fract(x: number): number {
  return x - Math.floor(x);
}
