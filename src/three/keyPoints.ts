/**
 * keyPoints.ts — stands every chapter's key-point props (models/props.ts) beside the route,
 * so Joel and Ellie walk (ride, drive) PAST them, never through them.
 *
 * FIXED, LIKE REAL BUILDINGS: where each prop stands, which way it faces and how big it is
 * are all decided ONCE (playback/keyPoints.ts: next to the real place, never in the
 * travellers' way, never overlapping another prop, sized like the travellers passing it).
 * Nothing resizes, moves or pops in and out while the camera zooms or the story plays, and
 * all props are on the map from the first frame. (Ones far off screen are skipped while
 * drawing, which nobody can see.)
 *
 * GROUND: the prop stands just above the HIGHEST of 13 terrain heights under its footprint
 * (centre, a ring at half the radius, a ring at the edge), and its dark base reaches well below
 * ground (props.ts) — on a slope the base disappears into the hillside instead of the prop
 * sinking into it.
 *
 * FRAME OF REFERENCE: the 3D layer's camera is centred on the travellers, in local units of
 * "metres at the travellers' latitude" (x = east, y = up, z = south). A real metre at the
 * prop's own latitude is a slightly different number of those units (Mercator stretches
 * the map towards the poles), so each prop is scaled by that ratio every frame — otherwise
 * props would subtly grow or shrink as the travellers moved north or south.
 */
import * as THREE from 'three';
import type { Map as MapboxMap } from 'mapbox-gl';
import { mercatorX, mercatorY, meterInMercatorUnits } from '../geo/mercator';
import type { KeyPointPlacement } from '../playback/keyPoints';
import { createProp } from './models/props';
import { emittersOf, type ParticleEmitter } from './fire';

/** Props whose centre projects further than this many screen-widths off screen are skipped. */
const CULL_MARGIN = 1;
/** How far above the highest terrain sample a prop stands (model metres). */
const LIFT = 0.08;
/** Metres per degree of latitude (and of longitude at the equator). */
const METRES_PER_DEGREE = 111_320;
const DEG = Math.PI / 180;

/** One prop with everything about it precomputed (the route never changes). */
interface PlacedProp {
  object: THREE.Group;
  /** The prop's centre (beside the route). */
  lng: number;
  lat: number;
  mx: number;
  my: number;
  /** Real metres per model metre (its fixed size). */
  metresPerModel: number;
  /** Mercator units per metre at its latitude. */
  unitsPerMeter: number;
  /** Points under its footprint where the terrain height is sampled. */
  samples: [number, number][];
  /** Its particle emitters (fire, smoke), if any — animated every frame while on screen. */
  emitters: ParticleEmitter[];
}

/** Inputs for one frame (the layer computes these anyway for the travellers). */
export interface KeyPointFrame {
  /** Travellers' position in mercator units, and their terrain height (m). */
  mx: number;
  my: number;
  elevation: number;
  /** Mercator units per metre at the travellers' latitude (as in the layer's model matrix). */
  unitsPerMeter: number;
}

export class KeyPointProps {
  readonly group = new THREE.Group();
  /** The rabbit of The Hunt (props.ts), which Ellie shoots in Lakeside Resort (hunt.ts); null if absent. */
  huntRabbit: THREE.Object3D | null = null;
  private readonly props: PlacedProp[] = [];

  constructor(placements: readonly KeyPointPlacement[]) {
    for (const placement of placements) {
      const { root } = createProp(placement.prop);
      const { lng, lat, radiusMetres } = placement;
      // Terrain samples under the footprint: the centre, a ring of 4 at half the radius and a
      // ring of 8 at the edge (13 in all), so a ridge between samples cannot poke through.
      const kLng = radiusMetres / (METRES_PER_DEGREE * Math.cos(lat * DEG));
      const kLat = radiusMetres / METRES_PER_DEGREE;
      const samples: [number, number][] = [[lng, lat]];
      for (const [reach, count] of [[0.5, 4], [1, 8]] as const) {
        for (let k = 0; k < count; k++) {
          const angle = (k / count) * Math.PI * 2;
          samples.push([lng + Math.cos(angle) * kLng * reach, lat + Math.sin(angle) * kLat * reach]);
        }
      }
      // Turn the prop so its front (−Z) looks at the route: the route's heading turn (as for
      // the travellers) plus a quarter turn towards the road from its side.
      // (`faceCamera`: half a turn instead, so the front looks south — at the north-up camera.)
      root.rotation.y =
        placement.heading !== undefined
          ? -placement.heading * DEG // an exact landmark: along its real axis (its length is the model's Z)
          : placement.faceCamera
            ? Math.PI
            : -placement.bearing * DEG + (placement.side * Math.PI) / 2;
      this.group.add(root);
      this.huntRabbit ??= (root.userData['huntRabbit'] as THREE.Object3D | undefined) ?? null;
      this.props.push({
        object: root,
        lng,
        lat,
        mx: mercatorX(lng),
        my: mercatorY(lat),
        metresPerModel: placement.metresPerModel,
        unitsPerMeter: meterInMercatorUnits(lat),
        samples,
        emitters: emittersOf(root),
      });
    }
  }

  /** Puts every (on-screen) prop in place for this frame, relative to the travellers. */
  update(map: MapboxMap, frame: KeyPointFrame): void {
    const toLocal = 1 / frame.unitsPerMeter;
    const terrain = !!map.getTerrain();
    const canvas = map.getCanvas();
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    for (const prop of this.props) {
      // Skip props far off screen (cheap: one projection) — invisible either way.
      const screen = map.project([prop.lng, prop.lat]);
      const onScreen =
        screen.x > -width * CULL_MARGIN &&
        screen.x < width * (1 + CULL_MARGIN) &&
        screen.y > -height * CULL_MARGIN &&
        screen.y < height * (1 + CULL_MARGIN);
      prop.object.visible = onScreen;
      if (!onScreen) continue;
      // Stand on the highest ground under the footprint.
      let ground = 0;
      if (terrain) {
        ground = -Infinity;
        for (const sample of prop.samples) ground = Math.max(ground, map.queryTerrainElevation(sample) ?? 0);
      }
      // Real metres at the prop's latitude → local units (see the file header).
      const ratio = prop.unitsPerMeter * toLocal;
      prop.object.position.set(
        (prop.mx - frame.mx) * toLocal,
        // A hair above the highest sample (LIFT model metres): the rendered terrain between
        // samples can sit slightly higher than any of them.
        (ground + LIFT * prop.metresPerModel) * ratio - (terrain ? frame.elevation : 0),
        (prop.my - frame.my) * toLocal,
      );
      prop.object.scale.setScalar(prop.metresPerModel * ratio);
      if (prop.emitters.length > 0) {
        // Particles are sized in model metres: tell them how many screen pixels one model metre
        // of this prop covers right now (project the centre and a point one model metre east).
        const east = prop.metresPerModel / (METRES_PER_DEGREE * Math.cos(prop.lat * DEG));
        const a = map.project([prop.lng, prop.lat]);
        const b = map.project([prop.lng + east, prop.lat]);
        const pxPerUnit = Math.hypot(b.x - a.x, b.y - a.y);
        const time = performance.now() / 1000;
        const pixelRatio = window.devicePixelRatio || 1;
        for (const emitter of prop.emitters) emitter.update(time, pxPerUnit, pixelRatio);
      }
    }
  }
}
