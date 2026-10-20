/**
 * JourneyLayer.ts — Three.js drawn INSIDE the Mapbox map.
 *
 * HOW THE TWO LIBRARIES SHARE THE SCREEN
 * ──────────────────────────────────────
 * Mapbox lets us add a "custom layer": an object with `onAdd`, `render` and
 * `onRemove` methods. Mapbox calls `render(gl, matrix)` every time it paints
 * the map, handing us:
 *   • `gl`     – Mapbox's own WebGL context. We create our Three.js renderer on
 *                top of it, so there is only ONE WebGL context on the page and
 *                3D objects are correctly hidden behind mountains;
 *   • `matrix` – the camera's projection for Web-Mercator coordinates (a 4×4
 *                matrix that turns a map position into a screen position).
 *
 * Our 3D scene uses its own small "local" coordinate system centred on Joel
 * and Ellie (metres; x = east, y = up, z = south). Each frame we build a
 * `modelMatrix` that places that local system at the travellers' real map
 * position, and multiply it into Mapbox's matrix. That single matrix is all
 * Three.js needs to draw the scene exactly where the map expects it.
 *
 * WHAT THIS LAYER DRAWS (and nothing else)
 *   • the travellers (walking pair, horse with riders, or truck with riders)
 *   • a comet flying over jump arcs
 *   • the glowing trail, dust, seasonal particles, destination ripple, shadow
 * The route lines, jump arrows and markers are drawn by Mapbox itself.
 *
 * WHERE THE DATA COMES FROM
 *   Only from `engine.frame` (the single source of truth). This layer never
 *   moves the story; it only reads it. When the story is paused, every value it
 *   reads stays the same, so the travellers freeze naturally.
 */
import * as THREE from 'three';
import type { CustomLayerInterface, Map as MapboxMap } from 'mapbox-gl';
import type { PlaybackEngine } from '../playback/engine';
import type { TravelMode, Traveller } from '../data/types';
import { isJumpKind } from '../playback/timeline';
import { mercatorX, mercatorY, meterInMercatorUnits } from '../geo/mercator';
import type { MutableLngLat } from '../geo/polyline';
import {
  BILL,
  createCharacter,
  DAVID,
  ELLIE,
  HENRY,
  JOEL,
  SAM,
  TOMMY,
  poseIdle,
  poseSeated,
  poseWalk,
  poseWounded,
  TESS,
  type Character,
} from './models/character';
import { createHorse, poseHorse, poseHorseIdle, type Horse } from './models/horse';
import { createTruck, poseTruck, type Truck } from './models/truck';
import { disposeGeometries, disposeMaterials } from './materials';
import { Beacon, BlobShadow, Comet, createSharedTexture, Dust, Trail, TRAIL_POINTS, TRAIL_STYLE } from './effects';
import { Ambience } from './ambience';
import { KeyPointProps } from './keyPoints';
import { keyPointPlacements, type KeyPointPlacement } from '../playback/keyPoints';

/** Degrees → radians multiplier (Three.js angles are in radians: 180° = π). */
const DEG = Math.PI / 180;

export interface JourneyLayerOptions {
  /** Return true to draw dust and seasonal particles (false on low-power devices). */
  effectsEnabled: () => boolean;
  /** Return true when the user prefers reduced motion. */
  reducedMotion: () => boolean;
}

/**
 * How tall the travellers should appear ON SCREEN, in pixels. Real people are
 * a fraction of a pixel at these zoom levels, so the models are "exaggerated"
 * to a constant, readable screen size. The truck is long, so it gets a smaller
 * height to keep its length in proportion with the walkers.
 */
// Walkers 81 px (58 px + 40 %, so the characters read clearly next to the key-point props).
const SCREEN_HEIGHT_PX: Record<TravelMode, number> = { walk: 81, horse: 60, vehicle: 40 };
/** Real model heights in metres (used to turn the pixel size above into a scale factor). */
const MODEL_HEIGHT_M: Record<TravelMode, number> = { walk: 1.85, horse: 2.6, vehicle: 2.1 };
/** Dust puffs per second of story time. */
const DUST_RATE: Record<TravelMode, number> = { walk: 0, horse: 14, vehicle: 24 };
/** Shadow footprint in model metres (width, length). */
const SHADOW_SIZE: Record<TravelMode, [number, number]> = { walk: [2.2, 1.6], horse: [1.5, 3.2], vehicle: [2.8, 6.2] };
/** Walk/gallop cycles per second, and how fast the truck "drives" for its wheel spin (m/s). */
const HORSE_GAIT_HZ = 1.3;
/** Every character that can walk on the map. */
const TRAVELLERS: readonly Traveller[] = ['joel', 'ellie', 'tess', 'bill', 'henry', 'sam', 'tommy', 'david'];
/** Steps per second: shorter legs take quicker steps. */
const STEPS_HZ: Record<Traveller, number> = {
  joel: 1.05,
  ellie: 1.25,
  tess: 1.12,
  bill: 1.0,
  henry: 1.08,
  sam: 1.22,
  tommy: 1.05,
  david: 1.0,
};
/** Phase offsets (radians) so nobody walks perfectly in step with the others. */
const PHASE_OFFSET: Record<Traveller, number> = {
  joel: 0,
  ellie: 1.3,
  tess: 2.4,
  bill: 3.6,
  henry: 4.4,
  sam: 5.2,
  tommy: 0.7,
  david: 2.9,
};
/**
 * Walking formations (x = metres to the right of the route, z = metres BEHIND the leader),
 * for 1, 2, 3 and 4 travellers, in party order. Three: left, middle (half a step ahead),
 * right. Four: a shallow V with the middle two in front.
 */
const WALK_FORMATION: readonly (readonly (readonly [number, number])[])[] = [
  [[0, 0]],
  [
    [-0.42, 0],
    [0.48, 0.35],
  ],
  [
    [-0.75, 0.1],
    [0.05, -0.25],
    [0.85, 0.35],
  ],
  [
    [-1.15, 0.2],
    [-0.38, -0.2],
    [0.38, -0.2],
    [1.15, 0.25],
  ],
];
/**
 * Wounded Joel lying across the horse: height of his body above the horse's centre
 * (the horse's back is at +0.33), where along the horse he lies (behind Ellie), and where
 * his hips sit sideways (0 = centred on the spine; his body hangs down both flanks).
 */
const WOUNDED_BACK_HEIGHT = 0.46;
const WOUNDED_Z = 0.3;
const WOUNDED_HIP_X = 0;
const TRUCK_VISUAL_SPEED = 9;
/**
 * Smoothing of the drawn route: ±this many screen pixels (see smoothedPointAt), at most
 * SMOOTH_MAX_M metres. Rides and drives are smoothed more: they cover long, winding mountain
 * roads quickly (Lakeside Resort's ride), where the raw switchbacks read as zig-zagging.
 */
const SMOOTH_PX: Record<TravelMode, number> = { walk: 10, horse: 25, vehicle: 20 };
const SMOOTH_MAX_M = 6000;
/** How fast the travellers' extra model size eases in and out (per second; ~1 s to settle). */
const MODEL_SCALE_SPEED = 3;
/** Fraction of a bridge crossing (at each end) over which the drawn path slides onto the deck. */
const CROSSING_BLEND = 0.12;
/** Distance used to measure "pixels per metre" at the travellers' position. */
const MEASURE_METRES = 100;

export class JourneyLayer implements CustomLayerInterface {
  /** Mapbox needs a unique id and the type 'custom'. `as const` keeps the literal type. */
  readonly id = 'journey-3d';
  readonly type = 'custom' as const;
  /** '3d' = share the depth buffer with the map, so terrain can hide our objects. */
  readonly renderingMode = '3d' as const;

  private map: MapboxMap | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  /** A bare camera: we set its projection matrix ourselves every frame. */
  private readonly camera = new THREE.Camera();
  private readonly engine: PlaybackEngine;
  private readonly options: JourneyLayerOptions;

  /** Real-scale geographic effects (trail, dust, particles, beacon), in metres. */
  private readonly geo = new THREE.Group();
  /** The exaggerated travellers (scaled up to their screen size every frame). */
  private readonly subject = new THREE.Group();
  /** The three ways of travelling; exactly one is visible at a time. `!` = assigned in onAdd. */
  private rigs!: {
    walk: { group: THREE.Group; people: Record<Traveller, Character> };
    horse: { group: THREE.Group; horse: Horse; joel: Character; ellie: Character };
    vehicle: { group: THREE.Group; truck: Truck; joel: Character; ellie: Character };
  };
  private trail!: Trail;
  private comet!: Comet;
  private dust!: Dust;
  private ambience!: Ambience;
  private beacon!: Beacon;
  /** The chapters' key-point props standing beside the route (keyPoints.ts). */
  private keyPoints!: KeyPointProps;
  private shadow!: BlobShadow;
  private texture!: THREE.Texture;

  // Scratch objects reused every frame (no garbage → no stutter from the garbage collector).
  private readonly pos: MutableLngLat = [0, 0];
  private readonly tmp: MutableLngLat = [0, 0];
  private readonly smoothScratch: MutableLngLat = [0, 0];
  private readonly trailCentre = new Float64Array(TRAIL_POINTS * 2);
  private readonly mapMatrix = new THREE.Matrix4();
  private readonly modelMatrix = new THREE.Matrix4();
  private readonly scaleMatrix = new THREE.Matrix4();
  /** Three.js is "y up"; Mapbox's mercator space is "z up". This 90° turn about X converts between them. */
  private readonly rotationMatrix = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  /** Story time seen in the previous frame (to compute how much story time passed, for dust). */
  private lastStoryTime = -1;
  /**
   * Smoothing window (metres) for where the travellers and their trail are drawn — see
   * smoothedPointAt(). Set each frame from the zoom (last frame's, which is close enough).
   */
  private smoothWindow = 0;
  /** Current (eased) extra size of the travellers' models — see `camera.modelScale`. */
  private modelScale = 1;
  /** Time of the previous frame (performance.now()), for the easing above. */
  private lastFrameAt = performance.now();
  /** Bridge crossings (playback/keyPoints.ts): where the travellers walk straight along a deck. */
  private crossings: NonNullable<KeyPointPlacement['crossing']>[] = [];
  /** Wall-clock reference for the seasonal particles. */
  private readonly startWallTime = performance.now();

  constructor(engine: PlaybackEngine, options: JourneyLayerOptions) {
    this.engine = engine;
    this.options = options;
  }

  // ───────────────────────── lifecycle (called by Mapbox) ─────────────────────────

  /** Mapbox calls this once when the layer is added: create the renderer and the scene. */
  onAdd(map: MapboxMap, gl: WebGL2RenderingContext): void {
    this.map = map;
    // Mapbox may leave "premultiply alpha" switched on for texture uploads. Three.js uploads
    // small placeholder 3D textures while it starts up, and WebGL refuses those with that flag
    // on (console warning). So clear the upload flags before creating the renderer.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    this.renderer.autoClear = false; // never erase what Mapbox already drew
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Soft sky/ground light plus a warm low "sun" — gives the low-poly facets depth.
    const hemi = new THREE.HemisphereLight(0xdfe6f2, 0x3a3026, 2.2);
    const sun = new THREE.DirectionalLight(0xffd9a8, 2.4);
    sun.position.set(-0.6, 1, 0.4);
    this.scene.add(hemi, sun);

    this.texture = createSharedTexture();
    this.trail = new Trail();
    this.comet = new Comet(this.texture);
    this.dust = new Dust(this.texture);
    this.ambience = new Ambience();
    this.beacon = new Beacon();
    this.shadow = new BlobShadow(this.texture);

    const placements = keyPointPlacements(this.engine.timeline, this.engine.chapters, this.engine.route);
    this.keyPoints = new KeyPointProps(placements);
    this.crossings = placements.flatMap((p) => (p.crossing ? [p.crossing] : []));

    this.geo.add(this.trail.mesh, this.comet.cloud.points, this.dust.cloud.points, this.ambience.group, this.beacon.mesh, this.keyPoints.group);
    this.scene.add(this.geo, this.subject);
    this.subject.add(this.shadow.mesh);
    this.buildRigs();
  }

  /** Mapbox calls this when the layer (or the whole map) is removed: free every GPU resource. */
  onRemove(): void {
    this.trail.dispose();
    this.comet.dispose();
    this.dust.dispose();
    this.ambience.dispose();
    this.beacon.dispose();
    this.shadow.dispose();
    this.texture.dispose();
    disposeGeometries();
    disposeMaterials();
    this.scene.clear();
    this.renderer?.dispose();
    this.renderer = null;
    this.map = null;
  }

  /** Builds the three rigs. Each rig has its own figures posed for that way of travelling. */
  private buildRigs(): void {
    // Walking: everyone who ever walks with them (Joel, Ellie and the companions) has a figure;
    // the current party decides who is shown and where (see poseRigs).
    const walkGroup = new THREE.Group();
    const people: Record<Traveller, Character> = {
      joel: createCharacter(JOEL),
      ellie: createCharacter(ELLIE),
      tess: createCharacter(TESS),
      bill: createCharacter(BILL),
      henry: createCharacter(HENRY),
      sam: createCharacter(SAM),
      tommy: createCharacter(TOMMY),
      david: createCharacter(DAVID),
    };
    for (const name of TRAVELLERS) walkGroup.add(people[name].root);

    // Horseback: Joel in the saddle holding the reins, Ellie behind him.
    const horseGroup = new THREE.Group();
    const horse = createHorse();
    const horseJoel = createCharacter(JOEL);
    const horseEllie = createCharacter(ELLIE);
    seat(horseJoel, horse.body, horse.saddleFront);
    seat(horseEllie, horse.body, horse.saddleBack);
    horseGroup.add(horse.root);

    // Truck: Joel driving (left seat), Ellie as passenger.
    const truckGroup = new THREE.Group();
    const truck = createTruck();
    const truckJoel = createCharacter(JOEL);
    const truckEllie = createCharacter(ELLIE);
    seat(truckJoel, truck.body, truck.driverSeat);
    seat(truckEllie, truck.body, truck.passengerSeat);
    truckGroup.add(truck.root);

    this.subject.add(walkGroup, horseGroup, truckGroup);
    this.rigs = {
      walk: { group: walkGroup, people },
      horse: { group: horseGroup, horse, joel: horseJoel, ellie: horseEllie },
      vehicle: { group: truckGroup, truck, joel: truckJoel, ellie: truckEllie },
    };
  }

  // ───────────────────────── per-frame drawing ─────────────────────────

  /** Mapbox calls this every time it paints. Everything here must be fast and allocation-free. */
  render(gl: WebGL2RenderingContext, matrix: number[]): void {
    const map = this.map;
    const renderer = this.renderer;
    if (!map || !renderer) return;

    const engine = this.engine;
    const frame = engine.frame;
    const route = engine.route;
    const chapter = engine.chapters[frame.chapterIndex]!;

    // 1) Where are the travellers, and how do they travel right now?
    const distance = frame.distance;
    // Drawn on the lightly smoothed route (see smoothedPointAt), within the current stretch.
    const stretchStart = this.trailStartDistance();
    const stretchEnd = this.stretchEndDistance();
    this.drawnPointAt(distance, this.pos, stretchStart, stretchEnd);
    const lng = this.pos[0];
    const lat = this.pos[1];
    const legIndex = Math.max(0, frame.legIndex);
    const leg = route.legs[legIndex]!;
    const jumping = isJumpKind(leg.kind);
    // The current part of the chapter decides HOW they travel and WHO travels (in Lakeside
    // Resort Ellie and Joel are separated), so read both from the timeline span.
    const span = engine.timeline.chapters[frame.chapterIndex]!.legSpans[frame.spanIndex]!;
    const mode = span.mode;
    const party = span.party;

    // 2) How many metres one screen pixel covers EXACTLY at the travellers' position.
    //    We project the point and another point 100 m east of it, and measure the
    //    pixel distance. Unlike a formula based on zoom alone, this includes the
    //    camera tilt and perspective — so the truck no longer looks huge when it
    //    sits near the bottom (closest part) of a tilted view or during flights.
    const unitsPerMeter = meterInMercatorUnits(lat);
    const elevation = map.getTerrain() ? (map.queryTerrainElevation([lng, lat]) ?? 0) : 0;
    const metresPerPixel = this.measureMetresPerPixel(map, lng, lat, elevation);
    this.smoothWindow = jumping ? 0 : Math.min(metresPerPixel * SMOOTH_PX[mode], SMOOTH_MAX_M);

    // 3) Visibility: during a jump the travellers fade out and a comet takes over;
    //    they fade back in at the far end. (Fades take the first/last 15 % of the jump.)
    let travellers = 1;
    if (jumping) {
      const p = frame.partProgress;
      travellers = p < 0.5 ? 1 - smoothstep(0, 0.15, p) : smoothstep(0.85, 1, p);
    }

    // 4) Build the matrix that puts our local metres at the travellers' map position:
    //    move to the position (translate) → metres to mercator units (scale; −y because
    //    mercator y points south) → turn Three's "y up" into the map's "z up" (rotate).
    this.modelMatrix
      .makeTranslation(mercatorX(lng), mercatorY(lat), elevation * unitsPerMeter)
      .multiply(this.scaleMatrix.makeScale(unitsPerMeter, -unitsPerMeter, unitsPerMeter))
      .multiply(this.rotationMatrix);
    this.camera.projectionMatrix.copy(this.mapMatrix.fromArray(matrix).multiply(this.modelMatrix));

    // 5) Pose and scale the travellers.
    const storyTime = frame.time;
    // A part may draw the travellers larger (`camera.modelScale`, e.g. ×2 for Lakeside's ride).
    // Eased towards the target each frame so the size never snaps at a part's boundary.
    const now = performance.now();
    const frameSeconds = Math.min(0.1, (now - this.lastFrameAt) / 1000);
    this.lastFrameAt = now;
    const targetModelScale = jumping ? 1 : (span.camera.modelScale ?? 1);
    this.modelScale += (targetModelScale - this.modelScale) * (1 - Math.exp(-frameSeconds * MODEL_SCALE_SPEED));
    const scale = ((SCREEN_HEIGHT_PX[mode] * metresPerPixel) / MODEL_HEIGHT_M[mode]) * travellers * this.modelScale;
    this.subject.scale.setScalar(Math.max(scale, 1e-6)); // never exactly 0 (Three dislikes it)
    this.subject.visible = travellers > 0.001;
    // Smoothed heading: look 40 px behind and ahead along the route (at least 250/600 m).
    // (Rides and drives look further: they turn at every bend of a winding road otherwise.)
    const bearingWindow = Math.max(metresPerPixel * (mode === 'walk' ? 40 : 80), mode === 'walk' ? 250 : 600);
    let heading = route.journey.bearingAt(distance, bearingWindow);
    // On a bridge: face along the deck (blended in and out with the walk onto it).
    const crossing = this.crossingAt(distance);
    if (crossing) heading += (((crossing.bearing - heading + 540) % 360) - 180) * crossing.weight;
    this.subject.rotation.y = -heading * DEG;
    this.poseRigs(mode, party, span.wounded, frame.travelling, storyTime);
    // The chapters' key-point props: fixed size and place on the map (keyPoints.ts); only
    // their position relative to the travellers (the camera's centre) changes.
    this.keyPoints.update(map, { mx: mercatorX(lng), my: mercatorY(lat), elevation, unitsPerMeter });
    const [sw, sl] = SHADOW_SIZE[mode];
    this.shadow.setSize(sw, sl);

    // 6) Effects.
    const effects = this.options.effectsEnabled() && !this.options.reducedMotion();
    const pixelRatio = window.devicePixelRatio || 1;
    this.updateTrail(frame.travelling, jumping ? 'jump' : mode, distance, lng, lat, metresPerPixel, unitsPerMeter);
    this.comet.update(jumping ? 1 - travellers * 0.85 : 0, storyTime, pixelRatio);
    this.updateBeacon(frame.travelling, legIndex, lng, lat, elevation, metresPerPixel, unitsPerMeter, storyTime);

    let storyDt = storyTime - this.lastStoryTime;
    if (storyDt < 0 || storyDt > 0.5) {
      this.dust.reset(); // a seek happened: old puffs would be in the wrong place
      storyDt = 0;
    }
    this.lastStoryTime = storyTime;
    this.dust.cloud.material.uniforms['uPixelRatio']!.value = pixelRatio;
    this.dust.update(
      storyDt,
      effects && frame.travelling && !jumping ? DUST_RATE[mode] : 0,
      mercatorX(lng),
      mercatorY(lat),
      1 / unitsPerMeter,
      metresPerPixel,
    );
    this.dust.cloud.points.visible = effects;

    // Seasonal particles: only close up (they would be noise over a whole state),
    // and hidden during jumps (they would streak across the country).
    const zoom = map.getZoom();
    const ambientIntensity = effects && !jumping ? smoothstep(5.5, 7.5, zoom) : 0;
    this.ambience.update({
      kinds: chapter.ambience,
      time: (performance.now() - this.startWallTime) / 1000,
      metersPerPixel: metresPerPixel,
      worldX: mercatorX(lng) / unitsPerMeter,
      worldY: mercatorY(lat) / unitsPerMeter,
      intensity: ambientIntensity,
      pixelRatio,
    });

    // 7) Draw. `resetState` tells Three.js that Mapbox changed WebGL state behind its back;
    // the viewport must follow the canvas size (it changes when the window is resized).
    renderer.resetState();
    renderer.setViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.render(this.scene, this.camera);

    // Hand the shared WebGL context back the way Mapbox expects it. Three.js leaves
    // "flip Y / premultiply alpha" upload flags switched on after uploading a texture;
    // Mapbox then fails to upload its own 3D lighting texture (a console warning and
    // wrong colours). Resetting the two flags (and Three's state cache) prevents that.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    renderer.resetState();
  }

  /**
   * Metres covered by one screen pixel at (lng, lat), measured through the real camera.
   * Falls back to a safe value if the point is behind the camera (can happen mid-flight).
   */
  private measureMetresPerPixel(map: MapboxMap, lng: number, lat: number, elevation: number): number {
    // Both points at the SAME height (the travellers'): left to itself, Mapbox projects each
    // point onto its own terrain height, and on a steep mountainside the point 100 m east can
    // be far higher or lower — the measured size (and so the horse's size) jumped frame to
    // frame in Lakeside Resort's mountains. Mapbox's project() takes an altitude in metres as a
    // second argument (missing from its TypeScript types).
    const project = map.project.bind(map) as (lngLat: [number, number], altitude?: number) => { x: number; y: number };
    const a = project([lng, lat], elevation);
    // 100 m east, expressed in degrees of longitude at this latitude.
    const dLng = (MEASURE_METRES * meterInMercatorUnits(lat) * 360);
    const b = project([lng + dLng, lat], elevation);
    const pixels = Math.hypot(b.x - a.x, b.y - a.y);
    if (!Number.isFinite(pixels) || pixels < 1e-6) return 1000;
    return MEASURE_METRES / pixels;
  }

  /**
   * Shows the rig for the current travel mode and poses it.
   * All animation phases come from STORY time: frozen when paused, identical after
   * seeking, and continuous across leg and chapter boundaries.
   *
   * @param party   who travels, in walking order (see data/chapters.ts)
   * @param wounded Joel lies wounded across the horse while Ellie rides
   */
  private poseRigs(mode: TravelMode, party: readonly Traveller[], wounded: boolean, travelling: boolean, storyTime: number): void {
    const { walk, horse, vehicle } = this.rigs;
    walk.group.visible = mode === 'walk';
    horse.group.visible = mode === 'horse';
    vehicle.group.visible = mode === 'vehicle';
    const TAU = Math.PI * 2; // one full cycle in radians
    const joelHere = party.includes('joel');
    const ellieHere = party.includes('ellie');

    if (mode === 'walk') {
      // Walking formation: everyone in the party side by side across the route, in the
      // party's order, the middle person a step ahead. Unused characters are hidden.
      const slots = WALK_FORMATION[Math.min(party.length, WALK_FORMATION.length) - 1] ?? WALK_FORMATION[0]!;
      for (const name of TRAVELLERS) {
        const character = walk.people[name];
        const slot = party.indexOf(name);
        character.root.visible = slot >= 0;
        if (slot < 0) continue;
        const [x, z] = slots[slot] ?? [0, 0];
        character.root.position.set(x, 0, z);
        if (travelling) poseWalk(character, storyTime * TAU * STEPS_HZ[name] + PHASE_OFFSET[name]);
        else poseIdle(character, storyTime + PHASE_OFFSET[name]); // standing (only at the very end)
      }
    } else if (mode === 'horse') {
      const phase = storyTime * TAU * HORSE_GAIT_HZ;
      if (travelling) poseHorse(horse.horse, phase);
      else poseHorseIdle(horse.horse, storyTime);
      horse.joel.root.visible = joelHere;
      horse.ellie.root.visible = ellieHere;
      // Ellie takes the front of the saddle (and the reins) when Joel is not riding normally.
      const ellieInFront = !joelHere || wounded;
      const ellieSeat = ellieInFront ? horse.horse.saddleFront : horse.horse.saddleBack;
      horse.ellie.root.position.set(ellieSeat.x, ellieSeat.y - horse.ellie.hipHeight, ellieSeat.z);
      poseSeated(horse.ellie, travelling ? phase + 0.4 : 0, ellieInFront);
      if (wounded) {
        // Lying across the horse's back behind Ellie. poseWounded turns the body so the hips
        // end up hipHeight metres to the LEFT (−x) of the root — so the root goes hipHeight
        // to the right to put the hips on the horse's spine.
        horse.joel.root.position.set(WOUNDED_HIP_X + horse.joel.hipHeight, WOUNDED_BACK_HEIGHT, WOUNDED_Z);
        poseWounded(horse.joel, travelling ? phase : 0);
      } else {
        const seat = horse.horse.saddleFront;
        horse.joel.root.position.set(seat.x, seat.y - horse.joel.hipHeight, seat.z);
        poseSeated(horse.joel, travelling ? phase : 0, true);
      }
    } else {
      poseTruck(vehicle.truck, storyTime * TRUCK_VISUAL_SPEED, storyTime, travelling ? 1 : 0);
      vehicle.joel.root.visible = joelHere;
      vehicle.ellie.root.visible = ellieHere;
      poseSeated(vehicle.joel, 0, true);
      poseSeated(vehicle.ellie, 0, false);
    }
  }

  /** Samples the route behind the travellers and turns it into the glowing ribbon. */
  private updateTrail(
    visible: boolean,
    style: TravelMode | 'jump',
    distance: number,
    lng: number,
    lat: number,
    metresPerPixel: number,
    unitsPerMeter: number,
  ): void {
    this.trail.mesh.visible = visible;
    if (!visible) return;
    const look = TRAIL_STYLE[style];
    const length = look.lengthPx * metresPerPixel; // trail length in metres for this zoom
    // The trail never reaches back across a jump boundary (a detailed path and a leap
    // are different things), so it starts at the beginning of the current stretch.
    const minDistance = this.trailStartDistance();
    const maxDistance = this.stretchEndDistance();
    const ax = mercatorX(lng);
    const ay = mercatorY(lat);
    const toLocal = 1 / unitsPerMeter;
    for (let i = 0; i < TRAIL_POINTS; i++) {
      const d = Math.max(minDistance, distance - (length * i) / (TRAIL_POINTS - 1));
      // The same smoothed route the travellers are drawn on, so the trail stays under them.
      this.drawnPointAt(d, this.tmp, minDistance, maxDistance);
      // Mercator difference → local metres (x east, z south).
      this.trailCentre[i * 2] = (mercatorX(this.tmp[0]) - ax) * toLocal;
      this.trailCentre[i * 2 + 1] = (mercatorY(this.tmp[1]) - ay) * toLocal;
    }
    this.trail.update(this.trailCentre, TRAIL_POINTS, look.widthPx * metresPerPixel, metresPerPixel * 0.5);
    this.trail.setStyle(look.color, 0.9);
  }

  /**
   * Where the current "stretch" began: the start of the current jump, or — on a
   * detailed leg — the end of the most recent jump before it (or the very start).
   */
  /**
   * The route point at distance d, smoothed: a weighted average of the route over
   * ±smoothWindow metres (more weight near d — a "triangle" of 7 samples).
   *
   * WHY: in the Rockies the original route zig-zags in short switchbacks. On fast,
   * compressed stretches (Lakeside Resort's ride covers ~2.6 km of route per second) the
   * travellers then snapped left and right across the screen every few frames. Averaging over
   * about SMOOTH_PX screen pixels irons the zig-zags out; in a city, zoomed in, the window is
   * only a few metres and nothing visibly changes. Samples stay inside [min, max] — the
   * current stretch between jumps — so the line never bends towards a jump arc.
   */
  private smoothedPointAt(d: number, out: MutableLngLat, min: number, max: number): void {
    const journey = this.engine.route.journey;
    const window = this.smoothWindow;
    if (window < 1) {
      journey.pointAt(d, out);
      return;
    }
    let lng = 0;
    let lat = 0;
    let total = 0;
    for (let k = -3; k <= 3; k++) {
      const weight = 4 - Math.abs(k); // 1, 2, 3, 4, 3, 2, 1
      journey.pointAt(Math.min(max, Math.max(min, d + (window * k) / 3)), this.smoothScratch);
      lng += this.smoothScratch[0] * weight;
      lat += this.smoothScratch[1] * weight;
      total += weight;
    }
    out[0] = lng / total;
    out[1] = lat / total;
  }

  /** The drawn position at distance d: the smoothed route, or the straight deck line on a bridge. */
  private drawnPointAt(d: number, out: MutableLngLat, min: number, max: number): void {
    this.smoothedPointAt(d, out, min, max);
    const crossing = this.crossingAt(d);
    if (!crossing) return;
    out[0] += (crossing.lng - out[0]) * crossing.weight;
    out[1] += (crossing.lat - out[1]) * crossing.weight;
  }

  /**
   * BRIDGE CROSSING: the bridge stands exactly where the real one is, along its real axis, but
   * the original route only roughly follows it — the travellers wandered and turned on the deck.
   * While they cross (the `crossing` stretch from playback/keyPoints.ts) they are drawn on the
   * straight line between the deck's two ends instead, facing along it. Over the first and last
   * CROSSING_BLEND of the stretch the drawn position slides from the route onto the deck line
   * and back, so there is no jump. Returns how much of the deck line to use (0…1), the point on
   * it and its direction — or null when not on a bridge.
   */
  private crossingAt(d: number): { weight: number; lng: number; lat: number; bearing: number } | null {
    for (const c of this.crossings) {
      if (d < c.from || d > c.to) continue;
      const length = c.to - c.from;
      const t = (d - c.from) / length;
      const ramp = Math.min(t, 1 - t) / CROSSING_BLEND;
      const weight = ramp >= 1 ? 1 : ramp * ramp * (3 - 2 * ramp); // smoothstep: eases in and out
      const lng = c.start[0] + (c.end[0] - c.start[0]) * t;
      const lat = c.start[1] + (c.end[1] - c.start[1]) * t;
      // Compass direction start → end (degrees from north), on a small flat patch.
      const east = (c.end[0] - c.start[0]) * Math.cos((lat * Math.PI) / 180);
      const north = c.end[1] - c.start[1];
      const bearing = (Math.atan2(east, north) * 180) / Math.PI;
      return { weight, lng, lat, bearing };
    }
    return null;
  }

  /** Where the current stretch (between jumps) ends: the start of the next jump, or the journey's end. */
  private stretchEndDistance(): number {
    const route = this.engine.route;
    const current = Math.max(0, this.engine.frame.legIndex);
    if (isJumpKind(route.legs[current]!.kind)) return route.legEnd[current]!;
    for (let i = current + 1; i < route.legs.length; i++) {
      if (isJumpKind(route.legs[i]!.kind)) return route.legStart[i]!;
    }
    return route.journey.length;
  }

  private trailStartDistance(): number {
    const route = this.engine.route;
    const current = Math.max(0, this.engine.frame.legIndex);
    if (isJumpKind(route.legs[current]!.kind)) return route.legStart[current]!;
    for (let i = current - 1; i >= 0; i--) {
      if (isJumpKind(route.legs[i]!.kind)) return route.legEnd[i]!;
    }
    return 0;
  }

  /** Rippling glow at the end of the current leg (the next destination). */
  private updateBeacon(
    visible: boolean,
    legIndex: number,
    lng: number,
    lat: number,
    elevation: number,
    metresPerPixel: number,
    unitsPerMeter: number,
    storyTime: number,
  ): void {
    if (!visible) {
      this.beacon.update(0, 0, 1, 0, 0);
      return;
    }
    const route = this.engine.route;
    route.journey.pointAt(route.legEnd[legIndex]!, this.tmp);
    const toLocal = 1 / unitsPerMeter;
    const x = (mercatorX(this.tmp[0]) - mercatorX(lng)) * toLocal;
    const z = (mercatorY(this.tmp[1]) - mercatorY(lat)) * toLocal;
    const map = this.map;
    // With 3D terrain the destination may be higher or lower than the travellers.
    const destElevation = map?.getTerrain() ? (map.queryTerrainElevation([this.tmp[0], this.tmp[1]]) ?? 0) : 0;
    this.beacon.mesh.position.y = destElevation - elevation;
    this.beacon.update(x, z, metresPerPixel * 34, storyTime, 0.85);
  }
}

/** Puts a character on a seat: its hip joint lands exactly on the seat point. */
function seat(character: Character, parent: THREE.Object3D, seatPoint: THREE.Vector3): void {
  character.root.position.set(seatPoint.x, seatPoint.y - character.hipHeight, seatPoint.z);
  parent.add(character.root);
}

/** 0 below edge0, 1 above edge1, smooth S-curve in between (same as GLSL's smoothstep). */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}
