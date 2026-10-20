/**
 * hunt.ts — Ellie's hunt in Lakeside Resort: she stops beside The Hunt (props.ts), turns to
 * the rabbit, draws her bow, and shoots. The arrow arcs over to the rabbit, which topples over
 * and stays down for the rest of the story.
 *
 * WHEN: data/chapters.ts gives Ellie's first solo stretch a 5-second PAUSE (`pauseSeconds`,
 * `hunt`): the timeline (playback/timeline.ts) holds her still for those seconds, right where
 * she passes closest to The Hunt. Everything here is worked out from where the story clock
 * is inside that pause (0 at its start, 1 at its end), so pausing, seeking and replaying
 * always show exactly the same moment, like the walking does.
 *
 * THE FIVE SECONDS (fractions of the pause):
 *   0    – 0.15  she stops and turns to face the rabbit
 *   0.15 – 0.35  the bow comes up, upright in front of her
 *   0.35 – 0.55  she draws the string back to her cheek …
 *   0.55 – 0.62  … and holds her aim
 *   0.62         release: the arrow flies on a gentle arc …
 *   0.72         … and hits — the rabbit topples onto its side
 *   0.8  – 0.92  she lowers the bow
 *   0.85 – 1     and turns back to the way she was walking (the arrow vanishes at the end)
 *
 * SIZES: Ellie is drawn at screen size (JourneyLayer scales the travellers every frame) and the
 * rabbit at its prop's size, so the arrow — which flies from one to the other — is sized from
 * Ellie's current scale, a little oversized so it can be seen at map scale.
 */
import * as THREE from 'three';
import { part } from './materials';
import { BOW_CARRY_TILT, poseAim, type Character } from './models/character';

/** The moments of the hunt, as fractions of the pause (see the table above). */
const TURN_END = 0.15;
const RAISE_START = 0.15;
const RAISE_END = 0.35;
const DRAW_END = 0.55;
const RELEASE = 0.62;
const HIT = 0.72;
const LOWER_START = 0.8;
const LOWER_END = 0.92;
const TURN_BACK_START = 0.85;
/** How long the rabbit takes to topple over after the hit (seconds of story time). */
const TOPPLE_SECONDS = 0.3;
/** Height of Ellie's drawn bow above her feet, and its distance in front of her (her model metres). */
const BOW_HEIGHT = 1.2;
const BOW_REACH = 0.45;
/** The arrow's length in Ellie's model metres (about 60 % of her height: oversized to be seen). */
const ARROW_LENGTH = 0.9;
/** How high the arrow's arc rises in the middle, as a fraction of the shot's length. */
const ARC = 0.12;

/** 0 below edge0, 1 above edge1, smooth S-curve in between. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Where the hunt is right now (filled in by the layer every frame). */
export interface HuntFrame {
  /** True while the story clock is inside the hunt's pause. */
  active: boolean;
  /** 0‥1 through the pause (only meaningful while `active`). */
  progress: number;
  /** Story seconds since the arrow hit the rabbit (negative before it; the rabbit stays down after). */
  sinceHit: number;
  /** The travellers' heading along the route (degrees clockwise from north), before the hunt turns her. */
  routeHeading: number;
  /** The travellers' current scale (model metres → scene units: JourneyLayer's `subject.scale`). */
  scale: number;
}

export class Hunt {
  /** The arrow (built along +Z, tip forward), in the scene's units. */
  readonly arrow = new THREE.Group();
  private readonly start = new THREE.Vector3();
  private readonly end = new THREE.Vector3();
  private readonly at = new THREE.Vector3();
  private readonly ahead = new THREE.Vector3();

  constructor() {
    // A one-metre arrow (scaled every frame): a pale wooden shaft, a metal tip, red fletching.
    this.arrow.add(part('arrow-shaft', () => new THREE.BoxGeometry(0.04, 0.04, 1), 'bowWood'));
    this.arrow.add(part('arrow-tip', () => new THREE.ConeGeometry(0.05, 0.14, 6).rotateX(Math.PI / 2), 'metal', 0, 0, 0.55));
    for (const side of [-1, 1]) {
      const fletch = part('arrow-fletch', () => new THREE.BoxGeometry(0.01, 0.09, 0.16), 'crossRed', 0, 0, -0.42);
      fletch.rotation.z = side * 0.6; // two vanes, splayed like a V
      this.arrow.add(fletch);
    }
    this.arrow.visible = false;
  }

  /**
   * Poses Ellie, turns the travellers, flies the arrow and topples the rabbit for this frame.
   * Returns the heading (degrees) the travellers should face: the route's, or towards the
   * rabbit while she shoots. Call after the props have been placed for the frame.
   */
  update(frame: HuntFrame, ellie: Character, rabbit: THREE.Object3D | null): number {
    // The rabbit: upright until hit, then it topples onto its side (and stays down — seeking
    // back before the hit stands it up again).
    if (rabbit) rabbit.rotation.z = (Math.PI / 2) * smoothstep(0, TOPPLE_SECONDS, frame.sinceHit);
    this.arrow.visible = false;
    if (!frame.active || !rabbit) {
      ellie.bow?.rotation.set(0, 0, BOW_CARRY_TILT); // carried again (the walk poses only the arms)
      return frame.routeHeading;
    }
    const p = frame.progress;

    // Where the rabbit is, relative to the travellers (they are at the scene's origin; x = east,
    // y = up, z = south). Its prop was just moved for this frame, so refresh its world matrix.
    rabbit.updateWorldMatrix(true, false);
    rabbit.localToWorld(this.end.set(0, 0.1, 0)); // the middle of its body
    const toRabbit = Math.atan2(this.end.x, -this.end.z) / (Math.PI / 180); // its bearing from north

    // Turn to it, and back again at the end (always the short way round).
    const turn = smoothstep(0, TURN_END, p) * (1 - smoothstep(TURN_BACK_START, 1, p));
    const heading = frame.routeHeading + ((((toRabbit - frame.routeHeading) % 360) + 540) % 360 - 180) * turn;

    // Ellie's arms: raise the bow, draw, release (the string hand springs forward), lower.
    const aim = smoothstep(RAISE_START, RAISE_END, p) * (1 - smoothstep(LOWER_START, LOWER_END, p));
    const draw = p < RELEASE ? smoothstep(RAISE_END, DRAW_END, p) : 1 - smoothstep(RELEASE, RELEASE + 0.03, p);
    poseAim(ellie, aim, draw);

    // The arrow: from the drawn bow (in front of her, at its height) to the rabbit, on an arc.
    if (p >= RELEASE) {
      const length = Math.hypot(this.end.x, this.end.z);
      this.start.set((this.end.x / length) * BOW_REACH * frame.scale, BOW_HEIGHT * frame.scale, (this.end.z / length) * BOW_REACH * frame.scale);
      const u = Math.min(1, (p - RELEASE) / (HIT - RELEASE));
      this.pointOnArc(u, this.at);
      // Point it along its flight: towards a point a little further along the arc (once it has
      // landed, along the last bit of the flight, so it stays stuck in at the angle it hit).
      if (u < 1) this.pointOnArc(Math.min(1, u + 0.02), this.ahead);
      else {
        this.pointOnArc(0.98, this.ahead);
        this.ahead.sub(this.at).negate().add(this.at); // mirror: from the last bit through the end
      }
      this.arrow.position.copy(this.at);
      this.arrow.lookAt(this.ahead); // turns the arrow's +Z (its tip) towards that point
      this.arrow.scale.setScalar(ARROW_LENGTH * frame.scale);
      this.arrow.visible = true;
    }
    return heading;
  }

  /** The point `u` (0 = bow, 1 = rabbit) along the arrow's arc. */
  private pointOnArc(u: number, out: THREE.Vector3): THREE.Vector3 {
    out.lerpVectors(this.start, this.end, u);
    out.y += 4 * u * (1 - u) * ARC * this.start.distanceTo(this.end); // a parabola: 0 at both ends
    return out;
  }
}

/** The hunt's timing on the story clock: its fraction of the pause at which the arrow hits. */
export const HUNT_HIT = HIT;
