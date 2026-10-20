/**
 * fire.ts — fire and smoke PARTICLES for key-point props (the burning house in Bluff Springs, south Austin).
 *
 * Like the seasonal particles (ambience.ts), every particle is animated entirely on the GPU:
 * each one gets four random numbers once (its "seed"), and the vertex shader works out where it
 * is at any moment from the time alone. So hundreds of flickering flames cost the CPU nothing
 * but one time value per frame.
 *
 * HOW ONE PARTICLE LIVES (a loop that repeats forever):
 *   life = fract(time × speed + seed)        — 0 when it is born, rising to 1 when it dies
 *   it is born at a random spot of the emitter's base (a small flat area), rises `height` model
 *   metres over its life, wobbles sideways, and:
 *     • FIRE  – shrinks as it rises, and its colour goes yellow → orange → deep red while it
 *               fades out: hot at the base, cooling at the tips. Drawn with additive blending,
 *               so overlapping flames get brighter, like real fire.
 *     • SMOKE – grows as it rises, drifts away (a light wind) and fades from dark grey to
 *               nothing. Drawn with normal blending (smoke hides what is behind it).
 *   Because every particle has its own seed (start time, speed, spot), they are always at
 *   different stages, so the fire never "pulses" as a whole.
 *
 * SIZE ON SCREEN: particles live inside the prop (model metres), so they must grow and shrink
 * with the prop when the camera zooms. The layer measures, every frame, how many screen pixels
 * one model metre of this prop covers (`uPxPerUnit`, see three/keyPoints.ts) and the shader
 * multiplies the particle's size in model metres by it.
 */
import * as THREE from 'three';

export interface EmitterOptions {
  kind: 'fire' | 'smoke';
  /** Number of particles. */
  count: number;
  /** Where the emitter's base is, in the prop's model metres. */
  origin: [number, number, number];
  /** Width of the base area particles are born in (model metres). */
  spread: number;
  /** How high a particle rises over its life (model metres). */
  height: number;
  /** A particle's size at birth (model metres). */
  size: number;
}

const vertexShader = /* glsl */ `
  attribute vec4 aSeed;          // four random numbers in 0..1, fixed per particle
  uniform float uTime;           // seconds (wall clock)
  uniform float uKind;           // 0 = fire, 1 = smoke
  uniform float uSpread;
  uniform float uHeight;
  uniform float uSize;           // model metres
  uniform float uPxPerUnit;      // screen pixels per model metre of this prop (set every frame)
  uniform float uPixelRatio;     // device pixels per CSS pixel
  varying float vLife;
  varying float vSeed;

  void main() {
    bool smoke = uKind > 0.5;
    // Life: fire races up (about a second), smoke drifts slowly (several seconds).
    float speed = smoke ? 0.18 + 0.12 * aSeed.y : 0.8 + 0.7 * aSeed.y;
    float life = fract(uTime * speed + aSeed.x);
    // Birth spot on the base, then rising; fire narrows towards the tips, smoke widens.
    float narrow = smoke ? 1.0 + life * 1.2 : 1.0 - life * 0.6;
    vec3 p = position;                                   // the emitter's base (per particle: same)
    p.x += (aSeed.z - 0.5) * uSpread * narrow + sin(uTime * 3.0 + aSeed.w * 20.0) * 0.04 * life;
    p.z += (aSeed.w - 0.5) * uSpread * narrow + cos(uTime * 2.6 + aSeed.z * 17.0) * 0.04 * life;
    p.y += life * uHeight;
    if (smoke) p.x += life * life * uHeight * 0.35;      // a light wind bends the smoke away
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    float size = smoke ? uSize * (0.6 + life * 1.8) : uSize * (1.0 - life * 0.75);
    gl_PointSize = max(1.0, size * uPxPerUnit * uPixelRatio);
    vLife = life;
    vSeed = aSeed.y;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uKind;
  varying float vLife;
  varying float vSeed;

  void main() {
    // A soft round blob: bright in the middle, fading to nothing at the edge of the sprite.
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv) * 2.0;
    if (r > 1.0) discard;
    float soft = 1.0 - smoothstep(0.2, 1.0, r);
    if (uKind > 0.5) {
      // Smoke: dark grey, a little lighter as it thins; fades in quickly, out slowly.
      float alpha = smoothstep(0.0, 0.15, vLife) * (1.0 - vLife) * 0.55 * soft;
      vec3 colour = mix(vec3(0.16, 0.15, 0.14), vec3(0.38, 0.36, 0.34), vLife);
      gl_FragColor = vec4(colour, alpha);
    } else {
      // Fire: yellow-white at birth → orange → deep red as it cools, then gone.
      vec3 yellow = vec3(1.0, 0.86, 0.42);
      vec3 orange = vec3(1.0, 0.45, 0.1);
      vec3 red = vec3(0.7, 0.12, 0.04);
      vec3 colour = vLife < 0.4 ? mix(yellow, orange, vLife / 0.4) : mix(orange, red, (vLife - 0.4) / 0.6);
      float flicker = 0.75 + 0.25 * fract(sin(vSeed * 91.7 + vLife * 37.0) * 4375.5);
      float alpha = smoothstep(0.0, 0.08, vLife) * (1.0 - vLife) * soft * flicker;
      gl_FragColor = vec4(colour * alpha, alpha); // additive: colour already weighted by alpha
    }
  }
`;

/** One emitter of fire or smoke particles (a THREE.Points to add to a prop). */
export class ParticleEmitter {
  readonly points: THREE.Points;
  readonly material: THREE.ShaderMaterial;
  private readonly geometry: THREE.BufferGeometry;

  constructor(options: EmitterOptions) {
    const seeds = new Float32Array(options.count * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    // Every particle starts from the emitter's base; the shader moves it from there.
    const positions = new Float32Array(options.count * 3);
    for (let i = 0; i < options.count; i++) positions.set(options.origin, i * 3);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    const smoke = options.kind === 'smoke';
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uKind: { value: smoke ? 1 : 0 },
        uSpread: { value: options.spread },
        uHeight: { value: options.height },
        uSize: { value: options.size },
        uPxPerUnit: { value: 1 },
        uPixelRatio: { value: 1 },
      },
      transparent: true,
      depthWrite: false, // particles never hide each other or the house behind them
      blending: smoke ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false; // the map supplies the projection; Three's culling would be wrong
    this.points.renderOrder = smoke ? 4 : 5; // smoke first, then the glowing flames over it
  }

  /** Called every frame while the prop is on screen. */
  update(time: number, pxPerUnit: number, pixelRatio: number): void {
    const u = this.material.uniforms;
    u['uTime']!.value = time;
    u['uPxPerUnit']!.value = pxPerUnit;
    u['uPixelRatio']!.value = pixelRatio;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

/** Where a prop keeps its emitters (props.ts adds them; three/keyPoints.ts animates them). */
export function emittersOf(object: THREE.Object3D): ParticleEmitter[] {
  return (object.userData['emitters'] as ParticleEmitter[] | undefined) ?? [];
}

/** Adds an emitter to a prop group (and remembers it for animation). */
export function addEmitter(group: THREE.Group, options: EmitterOptions): void {
  const emitter = new ParticleEmitter(options);
  group.add(emitter.points);
  group.userData['emitters'] = [...emittersOf(group), emitter];
}
