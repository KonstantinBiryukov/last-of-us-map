/**
 * petGiraffe.ts — Ellie pets the giraffe in Bus Depot, as in the game.
 *
 * WHEN: data/chapters.ts gives Bus Depot a 6-second PAUSE where Joel and Ellie pass the giraffe
 * (`pauseSeconds`, `pet`). Everything here is worked out from where the story clock is inside
 * that pause (0 at its start, 1 at its end), so pausing and seeking show the same moment.
 *
 * WHY ELLIE WALKS OVER: the travellers are drawn at screen size and the giraffe at its map
 * size, so from the path she cannot reach it. She walks up to the giraffe's lowered head, pets
 * it, and walks back to Joel, who waits on the path.
 *
 * THE SIX SECONDS (fractions of the pause):
 *   0    – 0.12  they stop and turn towards the giraffe
 *   0.08 – 0.30  the giraffe bends its neck down and forward, towards Ellie
 *   0.10 – 0.34  Ellie walks up to its head …
 *   0.34 – 0.44  … raises her hand …
 *   0.44 – 0.80  … and touches its bowed head ONCE — one slow stroke — while the giraffe
 *                leans into her hand once
 *   0.80 – 0.86  hand down
 *   0.84 – 0.98  she walks back to Joel; the giraffe lifts its head again
 *   0.88 – 1     they turn back to the way they were going
 */
import * as THREE from 'three';
import { poseReach, poseWalk, type Character } from './models/character';

/** How far (her model metres) Ellie stands from the giraffe's head, so her raised hand meets it. */
const REACH = 0.45;
/** At most this far (her model metres) does she walk out to the giraffe (never across the map). */
const MAX_WALK = 6;
/** How far the giraffe's neck bends down and forward (radians, around its base). */
const NECK_BEND = 0.85;
/** The single touch: when it starts and ends (fractions of the pause). */
const TOUCH_START = 0.46;
const TOUCH_END = 0.78;

/** 0 below edge0, 1 above edge1, smooth S-curve in between. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Where the petting is right now (filled in by the layer every frame). */
export interface PetFrame {
  /** True while the story clock is inside the petting pause. */
  active: boolean;
  /** 0‥1 through the pause. */
  progress: number;
  /** The travellers' heading along the route (degrees clockwise from north). */
  routeHeading: number;
  /** Story seconds (for Ellie's steps). */
  time: number;
}

export class PetGiraffe {
  private readonly head = new THREE.Vector3();
  private readonly local = new THREE.Vector3();

  /**
   * Bends the giraffe's neck, walks and poses Ellie, and returns the heading (degrees) the
   * travellers should face. Call after the props are placed and the rigs posed for the frame.
   * @param subject  the travellers' group (JourneyLayer) — Ellie's position is in its units
   * @param slot     Ellie's usual place in the walking formation (her root's position now)
   */
  update(frame: PetFrame, subject: THREE.Object3D, ellie: Character, neck: THREE.Object3D | null, head: THREE.Object3D | null): number {
    if (neck) neck.rotation.x = 0;
    ellie.root.rotation.y = 0;
    if (!frame.active || !neck || !head) return frame.routeHeading;
    const p = frame.progress;

    // The giraffe bows its head (and lifts it again at the end), and leans into her hand ONCE
    // while she touches it: a single smooth dip over the touch (half a sine wave, 0 → 1 → 0).
    const bow = smoothstep(0.08, 0.3, p) * (1 - smoothstep(0.84, 0.98, p));
    const touch = Math.sin(Math.PI * Math.min(1, Math.max(0, (p - TOUCH_START) / (TOUCH_END - TOUCH_START)))); // one bump
    neck.rotation.x = -NECK_BEND * bow - touch * 0.07; // negative: the neck tips forward and down

    // Where its head is, as seen from the travellers (they are at the scene's origin).
    head.updateWorldMatrix(true, false);
    head.getWorldPosition(this.head);
    const toHead = Math.atan2(this.head.x, -this.head.z) / (Math.PI / 180); // bearing from north
    const turn = smoothstep(0, 0.12, p) * (1 - smoothstep(0.88, 1, p));
    const heading = frame.routeHeading + ((((toHead - frame.routeHeading) % 360) + 540) % 360 - 180) * turn;

    // Ellie's walk: from her place beside Joel to just in front of the head, and back.
    // (Worked out in the travellers' own units: the subject turned to face the giraffe.)
    subject.rotation.y = -heading * (Math.PI / 180);
    subject.updateWorldMatrix(true, false);
    this.local.copy(this.head);
    subject.worldToLocal(this.local);
    const home = ellie.root.position.clone();
    const dx = this.local.x - home.x;
    const dz = this.local.z - home.z;
    const distance = Math.hypot(dx, dz);
    const walk = Math.min(MAX_WALK, Math.max(0, distance - REACH)); // stop a hand's reach short
    const out = smoothstep(0.1, 0.34, p) * (1 - smoothstep(0.84, 0.98, p)); // 0 at Joel's side, 1 at the giraffe
    ellie.root.position.set(home.x + (dx / (distance || 1)) * walk * out, 0, home.z + (dz / (distance || 1)) * walk * out);
    const walking = (p > 0.1 && p < 0.34) || (p > 0.84 && p < 0.98);
    if (walking) {
      poseWalk(ellie, frame.time * Math.PI * 2 * 1.25);
      // Face the way she walks: out towards the giraffe, then back.
      const towards = Math.atan2(dx, dz); // angle of the walk in the subject's x–z plane
      ellie.root.rotation.y = p < 0.5 ? towards + Math.PI : towards;
    } else if (out > 0.5) {
      // At the giraffe: face it, reach up and stroke.
      ellie.root.rotation.y = Math.atan2(dx, dz) + Math.PI;
      const reach = smoothstep(0.34, 0.44, p) * (1 - smoothstep(0.8, 0.86, p));
      // One slow stroke down the giraffe's head (the hand dips once and comes back).
      const stroke = -Math.sin(Math.PI * Math.min(1, Math.max(0, (p - TOUCH_START) / (TOUCH_END - TOUCH_START)))) * 0.22;
      poseReach(ellie, reach, stroke);
    }
    return heading;
  }
}
