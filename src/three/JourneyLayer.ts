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
import type { TravelMode } from '../data/types';
import { isJumpKind } from '../playback/timeline';
import { mercatorX, mercatorY, meterInMercatorUnits } from '../geo/mercator';
import type { MutableLngLat } from '../geo/polyline';
import { createCharacter, ELLIE, JOEL, poseIdle, poseSeated, poseWalk, type Character } from './models/character';
import { createHorse, poseHorse, poseHorseIdle, type Horse } from './models/horse';
import { createTruck, poseTruck, type Truck } from './models/truck';
import { disposeGeometries, disposeMaterials } from './materials';
import { Beacon, BlobShadow, Comet, createSharedTexture, Dust, Trail, TRAIL_POINTS, TRAIL_STYLE } from './effects';
import { Ambience } from './ambience';

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
const SCREEN_HEIGHT_PX: Record<TravelMode, number> = { walk: 58, horse: 60, vehicle: 40 };
/** Real model heights in metres (used to turn the pixel size above into a scale factor). */
const MODEL_HEIGHT_M: Record<TravelMode, number> = { walk: 1.85, horse: 2.6, vehicle: 2.1 };
/** Dust puffs per second of story time. */
const DUST_RATE: Record<TravelMode, number> = { walk: 0, horse: 14, vehicle: 24 };
/** Shadow footprint in model metres (width, length). */
const SHADOW_SIZE: Record<TravelMode, [number, number]> = { walk: [2.2, 1.6], horse: [1.5, 3.2], vehicle: [2.8, 6.2] };
/** Walk/gallop cycles per second, and how fast the truck "drives" for its wheel spin (m/s). */
const JOEL_STEPS_HZ = 1.05;
const ELLIE_STEPS_HZ = 1.25; // shorter legs → quicker steps
const HORSE_GAIT_HZ = 1.3;
const TRUCK_VISUAL_SPEED = 9;
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
    walk: { group: THREE.Group; joel: Character; ellie: Character };
    horse: { group: THREE.Group; horse: Horse; joel: Character; ellie: Character };
    vehicle: { group: THREE.Group; truck: Truck; joel: Character; ellie: Character };
  };
  private trail!: Trail;
  private comet!: Comet;
  private dust!: Dust;
  private ambience!: Ambience;
  private beacon!: Beacon;
  private shadow!: BlobShadow;
  private texture!: THREE.Texture;

  // Scratch objects reused every frame (no garbage → no stutter from the garbage collector).
  private readonly pos: MutableLngLat = [0, 0];
  private readonly tmp: MutableLngLat = [0, 0];
  private readonly trailCentre = new Float64Array(TRAIL_POINTS * 2);
  private readonly mapMatrix = new THREE.Matrix4();
  private readonly modelMatrix = new THREE.Matrix4();
  private readonly scaleMatrix = new THREE.Matrix4();
  /** Three.js is "y up"; Mapbox's mercator space is "z up". This 90° turn about X converts between them. */
  private readonly rotationMatrix = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  /** Story time seen in the previous frame (to compute how much story time passed, for dust). */
  private lastStoryTime = -1;
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

    this.geo.add(this.trail.mesh, this.comet.cloud.points, this.dust.cloud.points, this.ambience.group, this.beacon.mesh);
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

  /** Builds the three rigs. Each rig has its own Joel and Ellie posed for that way of travelling. */
  private buildRigs(): void {
    // Walking: Joel on the left, Ellie a step behind on his right.
    const walkGroup = new THREE.Group();
    const walkJoel = createCharacter(JOEL);
    const walkEllie = createCharacter(ELLIE);
    walkJoel.root.position.set(-0.42, 0, 0);
    walkEllie.root.position.set(0.48, 0, 0.35);
    walkGroup.add(walkJoel.root, walkEllie.root);

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
      walk: { group: walkGroup, joel: walkJoel, ellie: walkEllie },
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
    route.journey.pointAt(distance, this.pos);
    const lng = this.pos[0];
    const lat = this.pos[1];
    const legIndex = Math.max(0, frame.legIndex);
    const leg = route.legs[legIndex]!;
    const jumping = isJumpKind(leg.kind);
    const mode = leg.mode;

    // 2) How many metres one screen pixel covers EXACTLY at the travellers' position.
    //    We project the point and another point 100 m east of it, and measure the
    //    pixel distance. Unlike a formula based on zoom alone, this includes the
    //    camera tilt and perspective — so the truck no longer looks huge when it
    //    sits near the bottom (closest part) of a tilted view or during flights.
    const unitsPerMeter = meterInMercatorUnits(lat);
    const metresPerPixel = this.measureMetresPerPixel(map, lng, lat);

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
    const elevation = map.getTerrain() ? (map.queryTerrainElevation([lng, lat]) ?? 0) : 0;
    this.modelMatrix
      .makeTranslation(mercatorX(lng), mercatorY(lat), elevation * unitsPerMeter)
      .multiply(this.scaleMatrix.makeScale(unitsPerMeter, -unitsPerMeter, unitsPerMeter))
      .multiply(this.rotationMatrix);
    this.camera.projectionMatrix.copy(this.mapMatrix.fromArray(matrix).multiply(this.modelMatrix));

    // 5) Pose and scale the travellers.
    const storyTime = frame.time;
    const scale = ((SCREEN_HEIGHT_PX[mode] * metresPerPixel) / MODEL_HEIGHT_M[mode]) * travellers;
    this.subject.scale.setScalar(Math.max(scale, 1e-6)); // never exactly 0 (Three dislikes it)
    this.subject.visible = travellers > 0.001;
    // Smoothed heading: look 40 px behind and ahead along the route (at least 250/600 m).
    const bearingWindow = Math.max(metresPerPixel * 40, mode === 'walk' ? 250 : 600);
    this.subject.rotation.y = -route.journey.bearingAt(distance, bearingWindow) * DEG;
    this.poseRigs(mode, frame.travelling, storyTime);
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
  private measureMetresPerPixel(map: MapboxMap, lng: number, lat: number): number {
    const a = map.project([lng, lat]);
    // 100 m east, expressed in degrees of longitude at this latitude.
    const dLng = (MEASURE_METRES * meterInMercatorUnits(lat) * 360);
    const b = map.project([lng + dLng, lat]);
    const pixels = Math.hypot(b.x - a.x, b.y - a.y);
    if (!Number.isFinite(pixels) || pixels < 1e-6) return 1000;
    return MEASURE_METRES / pixels;
  }

  /**
   * Shows the rig for the current travel mode and poses it.
   * All animation phases come from STORY time: frozen when paused, identical after
   * seeking, and continuous across leg and chapter boundaries.
   */
  private poseRigs(mode: TravelMode, travelling: boolean, storyTime: number): void {
    const { walk, horse, vehicle } = this.rigs;
    walk.group.visible = mode === 'walk';
    horse.group.visible = mode === 'horse';
    vehicle.group.visible = mode === 'vehicle';
    const TAU = Math.PI * 2; // one full cycle in radians

    if (mode === 'walk') {
      if (travelling) {
        poseWalk(walk.joel, storyTime * TAU * JOEL_STEPS_HZ);
        poseWalk(walk.ellie, storyTime * TAU * ELLIE_STEPS_HZ + 1.3); // +1.3 = out of step with Joel
      } else {
        // Only at the very end of the story: standing in Jackson.
        poseIdle(walk.joel, storyTime);
        poseIdle(walk.ellie, storyTime + 2);
      }
    } else if (mode === 'horse') {
      const phase = storyTime * TAU * HORSE_GAIT_HZ;
      if (travelling) poseHorse(horse.horse, phase);
      else poseHorseIdle(horse.horse, storyTime);
      poseSeated(horse.joel, travelling ? phase : 0, true);
      poseSeated(horse.ellie, travelling ? phase + 0.4 : 0, false);
    } else {
      poseTruck(vehicle.truck, storyTime * TRUCK_VISUAL_SPEED, storyTime, travelling ? 1 : 0);
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
    const ax = mercatorX(lng);
    const ay = mercatorY(lat);
    const toLocal = 1 / unitsPerMeter;
    for (let i = 0; i < TRAIL_POINTS; i++) {
      const d = Math.max(minDistance, distance - (length * i) / (TRAIL_POINTS - 1));
      this.engine.route.journey.pointAt(d, this.tmp);
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
