/**
 * travellers.ts — the travellers' three "rigs" (a rig = the figures for one way of travelling)
 * and how they are posed every frame. Moved out of JourneyLayer.ts unchanged, to keep that
 * file about the map layer itself.
 *
 *   walk    – every character who ever walks with Joel and Ellie; the current party decides
 *             who is shown and where (side by side across the route, WALK_FORMATION)
 *   horse   – the horse with Joel and Ellie in the saddle (or Joel lying wounded across it)
 *   vehicle – the pickup truck with Joel driving and Ellie beside him
 *
 * JourneyLayer adds the rigs to its scene, scales and turns them, and calls poseRigs once per
 * frame. All animation phases come from STORY time, so they freeze when paused and are the
 * same after seeking.
 */
import * as THREE from 'three';
import type { TravelMode, Traveller } from '../data/types';
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
  poseWalkIntoWind,
  poseWounded,
  TESS,
  type Character,
} from './models/character';
import { createHorse, poseHorse, poseHorseIdle, type Horse } from './models/horse';
import { createTruck, poseTruck, type Truck } from './models/truck';

/** The three rigs; exactly one is visible at a time (see poseRigs). */
export interface Rigs {
  walk: { group: THREE.Group; people: Record<Traveller, Character> };
  horse: { group: THREE.Group; horse: Horse; joel: Character; ellie: Character };
  vehicle: { group: THREE.Group; truck: Truck; joel: Character; ellie: Character };
}

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
/**
 * How fast the truck's wheels turn: "visual" metres per story second (the real speed would
 * spin them far too fast to see). 4 m/s ≈ 1.5 turns a second. Faster (it used to be 9, ≈ 3.4
 * turns) and the screen's 60 frames a second sample the spin too coarsely, so the wheels
 * seem to stand still or even turn backwards (the "wagon-wheel" effect).
 */
const TRUCK_VISUAL_SPEED = 4;

/** Builds the three rigs. Each rig has its own figures posed for that way of travelling. */
export function createRigs(): Rigs {
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

  return {
    walk: { group: walkGroup, people },
    horse: { group: horseGroup, horse, joel: horseJoel, ellie: horseEllie },
    vehicle: { group: truckGroup, truck, joel: truckJoel, ellie: truckEllie },
  };
}

/**
 * Shows the rig for the current travel mode and poses it.
 * All animation phases come from STORY time: frozen when paused, identical after
 * seeking, and continuous across leg and chapter boundaries.
 *
 * @param rigs    the three rigs (createRigs)
 * @param party   who travels, in walking order (see data/chapters.ts)
 * @param wounded Joel lies wounded across the horse while Ellie rides
 */
export function poseRigs(rigs: Rigs, mode: TravelMode, party: readonly Traveller[], wounded: boolean, travelling: boolean, storyTime: number, blizzard = false): void {
  const { walk, horse, vehicle } = rigs;
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
      const phase = storyTime * TAU * STEPS_HZ[name] + PHASE_OFFSET[name];
      if (travelling && blizzard) poseWalkIntoWind(character, phase); // fighting through a snowstorm
      else if (travelling) poseWalk(character, phase);
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

/** Puts a character on a seat: its hip joint lands exactly on the seat point. */
function seat(character: Character, parent: THREE.Object3D, seatPoint: THREE.Vector3): void {
  character.root.position.set(seatPoint.x, seatPoint.y - character.hipHeight, seatPoint.z);
  parent.add(character.root);
}
