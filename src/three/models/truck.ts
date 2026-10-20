/**
 * truck.ts — a weathered pickup truck (Tommy's truck in the prologue, Bill's
 * truck on the way to Pittsburgh, and the car in the epilogue all use it).
 *
 * The cab has an open window band so the two seated passengers' heads and
 * shoulders are visible from above — that is how you can tell who is inside.
 *
 * Animated parts:
 *   • wheels spin according to distance travelled (rotation = distance ÷ radius);
 *   • the body rides on "suspension": it bobs and pitches with a mix of sine
 *     waves at different speeds, which reads as a bumpy road.
 *
 * Units are metres, facing north (−Z).
 */
import * as THREE from 'three';
import { part } from '../materials';

export interface Truck {
  root: THREE.Group;
  /** Everything above the wheels (moves with the suspension). */
  body: THREE.Group;
  wheels: THREE.Object3D[];
  /** Seat positions for driver (left) and passenger (right), relative to `body`. */
  driverSeat: THREE.Vector3;
  passengerSeat: THREE.Vector3;
}

export const WHEEL_RADIUS = 0.42;

export function createTruck(): Truck {
  const root = new THREE.Group();
  root.name = 'truck';

  const body = new THREE.Group();
  root.add(body);

  // Chassis and lower body.
  body.add(part('truck-chassis', () => new THREE.BoxGeometry(1.9, 0.55, 5.1), 'truckPaint', 0, 0.85, 0));
  body.add(part('truck-bumperF', () => new THREE.BoxGeometry(2.0, 0.2, 0.18), 'truckTrim', 0, 0.62, -2.6));
  body.add(part('truck-bumperR', () => new THREE.BoxGeometry(2.0, 0.2, 0.18), 'truckTrim', 0, 0.62, 2.6));
  // Hood (engine bay) slightly raised at the front.
  body.add(part('truck-hood', () => new THREE.BoxGeometry(1.86, 0.2, 1.45), 'truckPaint', 0, 1.2, -1.8));
  // Cab: lower doors, then four thin pillars holding the roof (open window band).
  body.add(part('truck-cabLow', () => new THREE.BoxGeometry(1.88, 0.35, 1.5), 'truckPaint', 0, 1.28, -0.45));
  for (const [x, z] of [
    [-0.88, -1.15],
    [0.88, -1.15],
    [-0.88, 0.25],
    [0.88, 0.25],
  ] as const) {
    body.add(part('truck-pillar', () => new THREE.BoxGeometry(0.08, 0.55, 0.08), 'truckTrim', x, 1.72, z));
  }
  body.add(part('truck-roof', () => new THREE.BoxGeometry(1.86, 0.1, 1.5), 'truckPaint', 0, 2.03, -0.45));
  // Truck bed: floor and three walls.
  body.add(part('truck-bedFloor', () => new THREE.BoxGeometry(1.8, 0.06, 2.2), 'truckTrim', 0, 1.15, 1.4));
  body.add(part('truck-bedSide', () => new THREE.BoxGeometry(0.08, 0.4, 2.2), 'truckPaint', -0.91, 1.32, 1.4));
  body.add(part('truck-bedSide', () => new THREE.BoxGeometry(0.08, 0.4, 2.2), 'truckPaint', 0.91, 1.32, 1.4));
  body.add(part('truck-tailgate', () => new THREE.BoxGeometry(1.86, 0.4, 0.08), 'truckPaint', 0, 1.32, 2.5));
  // Lights: warm headlights (emissive, they "glow"), red tail lights.
  body.add(part('truck-headlight', () => new THREE.BoxGeometry(0.3, 0.16, 0.06), 'headlight', -0.65, 1.0, -2.56));
  body.add(part('truck-headlight', () => new THREE.BoxGeometry(0.3, 0.16, 0.06), 'headlight', 0.65, 1.0, -2.56));
  body.add(part('truck-taillight', () => new THREE.BoxGeometry(0.16, 0.2, 0.06), 'truckPaint', -0.82, 1.05, 2.56));
  body.add(part('truck-taillight', () => new THREE.BoxGeometry(0.16, 0.2, 0.06), 'truckPaint', 0.82, 1.05, 2.56));

  // Wheels: a tyre cylinder + hubcap, turned on their side.
  const wheels: THREE.Object3D[] = [];
  for (const [x, z] of [
    [-0.95, -1.65],
    [0.95, -1.65],
    [-0.95, 1.65],
    [0.95, 1.65],
  ] as const) {
    const wheel = new THREE.Group();
    wheel.position.set(x, WHEEL_RADIUS, z);
    const tyre = part(
      'truck-tyre',
      () => new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.32, 10).rotateZ(Math.PI / 2),
      'tyre',
    );
    // The spin must read at map scale, where a wheel is a few pixels across: a bright hubcap
    // disc sticking out of the tyre on both sides, with a dark bar across it (like a spoke).
    // A round, evenly coloured wheel looks the same at every angle; the bar is what you see
    // turning.
    const hub = part(
      'truck-hubcap',
      () => new THREE.CylinderGeometry(WHEEL_RADIUS * 0.62, WHEEL_RADIUS * 0.62, 0.36, 10).rotateZ(Math.PI / 2),
      'hubcap',
    );
    const spoke = part(
      'truck-spoke',
      () => new THREE.BoxGeometry(0.38, WHEEL_RADIUS * 1.1, 0.1), // across the hubcap, a little proud of it
      'tyre',
    );
    wheel.add(tyre, hub, spoke);
    root.add(wheel);
    wheels.push(wheel);
  }

  return {
    root,
    body,
    wheels,
    driverSeat: new THREE.Vector3(-0.45, 0.62, -0.4),
    passengerSeat: new THREE.Vector3(0.45, 0.62, -0.4),
  };
}

/**
 * Drive animation.
 * @param distance  "visual" metres driven so far in this leg (spins the wheels).
 * @param time      story seconds (drives the suspension bounce).
 * @param amount    0 when parked, 1 when driving.
 */
export function poseTruck(t: Truck, distance: number, time: number, amount: number): void {
  const spin = -distance / WHEEL_RADIUS;
  for (const wheel of t.wheels) wheel.rotation.x = spin;
  // Suspension: a few sine waves with "unrelated" speeds look like an uneven road.
  const bump = Math.sin(time * 9.1) * 0.6 + Math.sin(time * 5.3 + 1.7) * 0.4;
  t.body.position.y = bump * 0.025 * amount;
  t.body.rotation.x = Math.sin(time * 4.2) * 0.012 * amount;
  t.body.rotation.z = Math.sin(time * 3.1 + 0.4) * 0.01 * amount;
}
