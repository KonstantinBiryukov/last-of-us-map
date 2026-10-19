/**
 * horse.ts — a stylised horse (in the game, Joel and Ellie ride from Jackson to
 * the university, and Ellie rides through the winter).
 *
 * Built like the characters: simple shapes on joints. Four legs, each with an
 * upper and lower segment, a neck that nods, and a tail that swings.
 *
 * Gait: a horse walks in a "four-beat" rhythm — each leg starts its step a
 * quarter of a cycle after the previous one, in the order left-hind,
 * left-front, right-hind, right-front. The `LEG_PHASE` offsets encode that.
 *
 * Units are metres, facing north (−Z).
 */
import * as THREE from 'three';
import { part } from '../materials';

export interface Horse {
  root: THREE.Group;
  body: THREE.Group;
  neck: THREE.Group;
  tail: THREE.Group;
  legs: { upper: THREE.Group; lower: THREE.Group; phase: number }[];
  /** Where riders sit, relative to `body`. */
  saddleFront: THREE.Vector3;
  saddleBack: THREE.Vector3;
}

const BODY_Y = 1.3;
const LEG_LEN = 0.55; // upper = lower

// Order: left-front, right-front, left-hind, right-hind, with the four-beat phase offsets.
const LEGS = [
  { x: -0.2, z: -0.7, phase: 0.25 },
  { x: 0.2, z: -0.7, phase: 0.75 },
  { x: -0.2, z: 0.75, phase: 0 },
  { x: 0.2, z: 0.75, phase: 0.5 },
] as const;

export function createHorse(): Horse {
  const root = new THREE.Group();
  root.name = 'horse';

  const body = new THREE.Group();
  body.position.y = BODY_Y;
  root.add(body);

  body.add(part('horse-body', () => new THREE.CapsuleGeometry(0.33, 1.3, 3, 8).rotateX(Math.PI / 2), 'horseCoat'));
  body.add(part('horse-saddle', () => new THREE.BoxGeometry(0.7, 0.12, 0.75), 'saddle', 0, 0.33, -0.05));
  body.add(part('horse-blanket', () => new THREE.BoxGeometry(0.72, 0.4, 0.8), 'strap', 0, 0.12, -0.05));

  // Neck pivots at the front top of the body and leans forward.
  const neck = new THREE.Group();
  neck.position.set(0, 0.18, -0.8);
  neck.rotation.x = -0.55;
  body.add(neck);
  const neckMesh = part('horse-neck', () => new THREE.BoxGeometry(0.26, 0.85, 0.36), 'horseCoat', 0, 0.38, 0);
  neck.add(neckMesh);
  neck.add(part('horse-mane', () => new THREE.BoxGeometry(0.08, 0.85, 0.12), 'horseMane', 0, 0.4, 0.18));
  const head = part('horse-head', () => new THREE.BoxGeometry(0.24, 0.26, 0.62), 'horseCoat', 0, 0.82, -0.18);
  head.rotation.x = 0.9;
  neck.add(head);
  neck.add(part('horse-ear', () => new THREE.ConeGeometry(0.04, 0.12, 4), 'horseMane', -0.07, 0.98, 0.05));
  neck.add(part('horse-ear', () => new THREE.ConeGeometry(0.04, 0.12, 4), 'horseMane', 0.07, 0.98, 0.05));

  const tail = new THREE.Group();
  tail.position.set(0, 0.15, 0.95);
  tail.rotation.x = -0.5;
  body.add(tail);
  const tailMesh = part('horse-tail', () => new THREE.CapsuleGeometry(0.06, 0.55, 2, 5), 'horseMane', 0, -0.3, 0.05);
  tail.add(tailMesh);

  const legs = LEGS.map((spec) => {
    const upper = new THREE.Group();
    upper.position.set(spec.x, -0.15, spec.z);
    body.add(upper);
    upper.add(
      part('horse-upper', () => new THREE.CapsuleGeometry(0.085, LEG_LEN - 0.17, 2, 5), 'horseCoat', 0, -LEG_LEN / 2, 0),
    );
    const lower = new THREE.Group();
    lower.position.y = -LEG_LEN;
    upper.add(lower);
    lower.add(
      part('horse-lower', () => new THREE.CapsuleGeometry(0.055, LEG_LEN - 0.11, 2, 5), 'horseCoat', 0, -LEG_LEN / 2, 0),
    );
    lower.add(part('horse-hoof', () => new THREE.BoxGeometry(0.13, 0.09, 0.15), 'hoof', 0, -LEG_LEN + 0.02, -0.01));
    return { upper, lower, phase: spec.phase * Math.PI * 2 };
  });

  return {
    root,
    body,
    neck,
    tail,
    legs,
    saddleFront: new THREE.Vector3(0, 0.38, -0.25),
    saddleBack: new THREE.Vector3(0, 0.38, 0.28),
  };
}

/** Walking gait. `phase` grows with the story clock while travelling. */
export function poseHorse(h: Horse, phase: number, amount = 1): void {
  for (const leg of h.legs) {
    const p = phase + leg.phase;
    leg.upper.rotation.x = Math.sin(p) * 0.42 * amount;
    // The lower leg folds while the hoof is lifted and swung forward.
    leg.lower.rotation.x = -Math.max(0, Math.sin(p + 1.3)) * 0.8 * amount;
  }
  h.body.position.y = BODY_Y + Math.sin(phase * 2) * 0.03 * amount;
  h.body.rotation.x = Math.sin(phase * 2 + 0.6) * 0.02 * amount;
  h.neck.rotation.x = -0.55 + Math.sin(phase * 2 + 1) * 0.07 * amount;
  h.tail.rotation.z = Math.sin(phase) * 0.2 * amount;
}

/** Standing: weight shifts and the tail flicks slowly. `time` in seconds. */
export function poseHorseIdle(h: Horse, time: number): void {
  for (const leg of h.legs) {
    leg.upper.rotation.x = 0;
    leg.lower.rotation.x = 0;
  }
  h.body.position.y = BODY_Y + Math.sin(time * 1.3) * 0.008;
  h.body.rotation.x = 0;
  h.neck.rotation.x = -0.55 + Math.sin(time * 0.5) * 0.08;
  h.tail.rotation.z = Math.sin(time * 1.7) * 0.15;
}
