/**
 * character.ts — Joel and Ellie as small, stylised, articulated figures.
 *
 * No downloaded model was used: there is no freely licensed Joel/Ellie model,
 * and a photoreal one would be far too heavy for a map overlay. Instead each
 * figure is built from ~14 simple shapes (boxes and capsules) arranged like a
 * puppet with joints:
 *
 *   root (feet on the ground)
 *    └─ hips ───────────────┬─ torso ─┬─ head (+ hair, beard or ponytail)
 *        │                  │         ├─ left arm  ─ left forearm
 *        │                  │         ├─ right arm ─ right forearm
 *        │                  │         └─ backpack
 *        ├─ left thigh  ─ left shin  (+ boot)
 *        └─ right thigh ─ right shin (+ boot)
 *
 * Rotating a joint rotates everything below it, exactly like a real skeleton.
 * The pose functions at the bottom move those joints with sine waves to create
 * a walk cycle, a seated riding pose, and a calm idle (breathing) pose.
 *
 * Recognisability comes from silhouette and colour: Joel is tall and broad
 * with a beard and a denim-blue shirt; Ellie is a head shorter, slimmer, with
 * an auburn ponytail and an olive t-shirt. Both carry backpacks.
 *
 * Units are metres. The model faces "north" (−Z) before it is rotated.
 */
import * as THREE from 'three';
import { part, type PaletteKey } from '../materials';

export interface CharacterLook {
  /** Also used as a key for caching each character's geometry sizes. */
  name: 'joel' | 'ellie' | 'tess' | 'bill' | 'henry' | 'sam' | 'tommy' | 'david' | 'maria' | 'marlene';
  /** Overall size multiplier (Joel = 1). */
  scale: number;
  /** Shoulder width multiplier (Joel is broader). */
  build: number;
  skin: PaletteKey;
  shirt: PaletteKey;
  pants: PaletteKey;
  hair: PaletteKey;
  beard: boolean;
  ponytail: boolean;
}

export const JOEL: CharacterLook = {
  name: 'joel',
  scale: 1,
  build: 1.1,
  skin: 'skin',
  shirt: 'joelShirt',
  pants: 'joelPants',
  hair: 'joelHair',
  beard: true,
  ponytail: false,
};

export const ELLIE: CharacterLook = {
  name: 'ellie',
  scale: 0.82,
  build: 0.92,
  skin: 'skinEllie',
  shirt: 'ellieShirt',
  pants: 'elliePants',
  hair: 'ellieHair',
  beard: false,
  ponytail: true,
};

/** The joints we animate. */
export interface Character {
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  forearmL: THREE.Group;
  forearmR: THREE.Group;
  thighL: THREE.Group;
  thighR: THREE.Group;
  shinL: THREE.Group;
  shinR: THREE.Group;
  ponytail: THREE.Group | null;
  /** Ellie's bow, held in her left hand (hidden unless a part says she carries it); null for others. */
  bow: THREE.Group | null;
  /** Height of the hip joint above the feet when standing. */
  hipHeight: number;
}

// Proportions for a 1.85 m adult; everything is multiplied by `scale`.
const LEG = 0.47; // thigh length = shin length
const TORSO_H = 0.6;
const ARM = 0.3;

/** A capsule (pill shape) hanging DOWN from its joint — perfect for limbs. */
function limb(key: string, radius: number, length: number, mat: PaletteKey): THREE.Mesh {
  const mesh = part(key, () => new THREE.CapsuleGeometry(radius, length - radius * 2, 2, 6), mat);
  mesh.position.y = -length / 2;
  return mesh;
}

function box(key: string, w: number, h: number, d: number, mat: PaletteKey, x = 0, y = 0, z = 0): THREE.Mesh {
  return part(key, () => new THREE.BoxGeometry(w, h, d), mat, x, y, z);
}

function joint(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

export function createCharacter(look: CharacterLook): Character {
  const s = look.scale;
  const k = look.name; // geometry cache key prefix (each character has its own sizes)
  const root = new THREE.Group();
  root.name = look.name;

  const hipHeight = LEG * 2 * s + 0.06 * s;
  const hips = joint(root, 0, hipHeight, 0);

  // ── Torso, backpack and head ──
  const torso = joint(hips, 0, 0, 0);
  const shoulderW = 0.44 * look.build * s;
  torso.add(box(`${k}-torso`, shoulderW, TORSO_H * s, 0.25 * s, look.shirt, 0, (TORSO_H * s) / 2, 0));
  torso.add(box(`${k}-belt`, shoulderW * 0.92, 0.08 * s, 0.26 * s, 'strap', 0, 0.02 * s, 0));
  torso.add(box(`${k}-pack`, shoulderW * 0.75, 0.42 * s, 0.18 * s, 'backpack', 0, 0.36 * s, 0.2 * s));
  torso.add(box(`${k}-strapL`, 0.05 * s, 0.5 * s, 0.27 * s, 'strap', -shoulderW * 0.3, 0.36 * s, 0.01 * s));
  torso.add(box(`${k}-strapR`, 0.05 * s, 0.5 * s, 0.27 * s, 'strap', shoulderW * 0.3, 0.36 * s, 0.01 * s));

  const head = joint(torso, 0, TORSO_H * s + 0.04 * s, 0);
  const headSize = 0.24 * s * (look.name === 'ellie' ? 1.05 : 1); // slightly bigger head reads "younger"
  head.add(box(`${k}-neck`, 0.1 * s, 0.08 * s, 0.1 * s, look.skin, 0, 0.02 * s, 0));
  head.add(box(`${k}-head`, headSize * 0.82, headSize, headSize * 0.9, look.skin, 0, 0.06 * s + headSize / 2, 0));
  // Hair: a cap on top and at the back.
  head.add(
    box(`${k}-hairTop`, headSize * 0.88, headSize * 0.3, headSize * 0.96, look.hair, 0, 0.06 * s + headSize * 0.92, 0.01 * s),
  );
  head.add(
    box(`${k}-hairBack`, headSize * 0.86, headSize * 0.75, headSize * 0.25, look.hair, 0, 0.06 * s + headSize * 0.6, headSize * 0.38),
  );
  if (look.beard) {
    head.add(
      box(`${k}-beard`, headSize * 0.8, headSize * 0.42, headSize * 0.2, look.hair, 0, 0.06 * s + headSize * 0.22, -headSize * 0.38),
    );
  }
  let ponytail: THREE.Group | null = null;
  if (look.ponytail) {
    ponytail = joint(head, 0, 0.06 * s + headSize * 0.78, headSize * 0.5);
    ponytail.add(limb(`${k}-ponytail`, 0.045 * s, 0.26 * s, look.hair));
    ponytail.rotation.x = 0.5; // hangs back and down
  }

  // ── Arms ──
  const armY = TORSO_H * s - 0.06 * s;
  const armX = shoulderW / 2 + 0.05 * s;
  const armL = joint(torso, -armX, armY, 0);
  const armR = joint(torso, armX, armY, 0);
  armL.add(limb(`${k}-upperArm`, 0.055 * s, ARM * s, look.shirt));
  armR.add(limb(`${k}-upperArm`, 0.055 * s, ARM * s, look.shirt));
  const forearmL = joint(armL, 0, -ARM * s, 0);
  const forearmR = joint(armR, 0, -ARM * s, 0);
  forearmL.add(limb(`${k}-forearm`, 0.05 * s, ARM * 0.95 * s, look.skin));
  forearmR.add(limb(`${k}-forearm`, 0.05 * s, ARM * 0.95 * s, look.skin));

  // ── Legs ──
  const legX = 0.11 * look.build * s;
  const thighL = joint(hips, -legX, 0, 0);
  const thighR = joint(hips, legX, 0, 0);
  thighL.add(limb(`${k}-thigh`, 0.08 * s, LEG * s, look.pants));
  thighR.add(limb(`${k}-thigh`, 0.08 * s, LEG * s, look.pants));
  const shinL = joint(thighL, 0, -LEG * s, 0);
  const shinR = joint(thighR, 0, -LEG * s, 0);
  shinL.add(limb(`${k}-shin`, 0.07 * s, LEG * s, look.pants));
  shinR.add(limb(`${k}-shin`, 0.07 * s, LEG * s, look.pants));
  shinL.add(box(`${k}-boot`, 0.13 * s, 0.1 * s, 0.24 * s, 'boots', 0, -LEG * s + 0.02 * s, -0.04 * s));
  shinR.add(box(`${k}-boot`, 0.13 * s, 0.1 * s, 0.24 * s, 'boots', 0, -LEG * s + 0.02 * s, -0.04 * s));

  // ── Ellie's bow (Lakeside Resort: she hunts alone) ──
  // Held at its grip in her left hand, hanging down beside her like a bow carried while
  // walking. Built in the hand's frame: the grip at the origin, the two limbs reaching up and
  // down and curving back (+Z), and the string stretched straight between their tips.
  // Hidden by default; JourneyLayer shows it for parts with `bow` (data/chapters.ts).
  let bow: THREE.Group | null = null;
  if (look.name === 'ellie') {
    bow = joint(forearmL, 0, -ARM * 0.95 * s, 0); // at the hand (the end of the forearm)
    bow.rotation.z = 0.2; // tilted out from her side, so her body never hides it
    // Larger and thicker than a real bow, in light wood: at the map's scale a true-to-life
    // bow is a hairline that disappears against the snow.
    const LIMB = 0.62 * s; // each limb's length: the whole bow about 80 % of her height
    const CURVE = 0.3; // how far each limb bends back from upright (radians)
    for (const up of [1, -1]) {
      // A limb: its inner end at the grip, its tip LIMB further up (or down) and bent back.
      const limbMesh = box(`${k}-bowLimb`, 0.07 * s, LIMB, 0.08 * s, 'bowWood');
      limbMesh.position.set(0, (up * LIMB * Math.cos(CURVE)) / 2, (LIMB * Math.sin(CURVE)) / 2);
      limbMesh.rotation.x = up * CURVE; // the tip leans back (towards +Z) for both limbs
      bow.add(limbMesh);
    }
    bow.add(box(`${k}-bowGrip`, 0.1 * s, 0.16 * s, 0.1 * s, 'strap')); // the leather-wrapped grip
    // The string: a thin line from tip to tip, behind the grip.
    bow.add(box(`${k}-bowString`, 0.02 * s, LIMB * Math.cos(CURVE) * 2, 0.02 * s, 'offWhite', 0, 0, LIMB * Math.sin(CURVE)));
    bow.visible = false;
  }

  return { root, hips, torso, head, armL, armR, forearmL, forearmR, thighL, thighR, shinL, shinR, ponytail, bow, hipHeight };
}

/** Tess: adult woman, a little shorter than Joel, hair tied back, tan jacket. */
export const TESS: CharacterLook = {
  name: 'tess',
  scale: 0.93,
  build: 0.95,
  skin: 'skinEllie',
  shirt: 'tessJacket',
  pants: 'tessPants',
  hair: 'tessHair',
  beard: false,
  ponytail: true,
};

/** Bill: stocky and broad, greying hair with stubble, olive work jacket. */
export const BILL: CharacterLook = {
  name: 'bill',
  scale: 0.97,
  build: 1.22,
  skin: 'skinBill',
  shirt: 'billJacket',
  pants: 'billPants',
  hair: 'billHair',
  beard: true,
  ponytail: false,
};

/** Henry: slim adult, a little shorter than Joel, grey-blue jacket. */
export const HENRY: CharacterLook = {
  name: 'henry',
  scale: 0.97,
  build: 1.0,
  skin: 'skinDark',
  shirt: 'henryJacket',
  pants: 'henryPants',
  hair: 'darkHair',
  beard: false,
  ponytail: false,
};

/** Sam: Henry's younger brother, about Ellie's size, blue hoodie. */
export const SAM: CharacterLook = {
  name: 'sam',
  scale: 0.78,
  build: 0.88,
  skin: 'skinDark',
  shirt: 'samHoodie',
  pants: 'samPants',
  hair: 'darkHair',
  beard: false,
  ponytail: false,
};

/** Tommy: Joel's younger brother — same height, brown jacket, beard. */
export const TOMMY: CharacterLook = {
  name: 'tommy',
  scale: 0.99,
  build: 1.06,
  skin: 'skin',
  shirt: 'tommyJacket',
  pants: 'tommyPants',
  hair: 'tommyHair',
  beard: true,
  ponytail: false,
};

/** Maria: Tommy's wife, who runs Jackson — not travelling: she stands at the dam with Tommy (props.ts). */
export const MARIA: CharacterLook = {
  name: 'maria',
  scale: 0.9,
  build: 0.92,
  skin: 'skin',
  shirt: 'mariaJacket',
  pants: 'mariaPants',
  hair: 'mariaHair',
  beard: false,
  ponytail: true,
};

/** Marlene: the Fireflies' leader — not travelling: she waits at the hospital door (props.ts). Short dark hair, olive field jacket. */
export const MARLENE: CharacterLook = {
  name: 'marlene',
  scale: 0.92,
  build: 0.95,
  skin: 'skinDark',
  shirt: 'marleneJacket',
  pants: 'marlenePants',
  hair: 'darkHair',
  beard: false,
  ponytail: false,
};

/** David: stocky, grey-bearded, in a sheepskin-brown coat. */
export const DAVID: CharacterLook = {
  name: 'david',
  scale: 1.0,
  build: 1.15,
  skin: 'skinBill',
  shirt: 'davidCoat',
  pants: 'davidPants',
  hair: 'davidHair',
  beard: true,
  ponytail: false,
};

// ───────────────────────── poses ─────────────────────────
// Sign convention: a positive X rotation swings a down-hanging limb FORWARD (towards −Z).

/**
 * Walk cycle. `phase` is an angle in radians that grows while walking (one full
 * stride per 2π). Because phase is computed from the story clock, the walk
 * freezes exactly when the story is paused and is identical after seeking.
 */
export function poseWalk(c: Character, phase: number, amount = 1): void {
  const swing = Math.sin(phase) * 0.55 * amount;
  c.thighL.rotation.x = swing;
  c.thighR.rotation.x = -swing;
  // Knees bend while the leg swings forward (the foot lifts off the ground).
  c.shinL.rotation.x = -Math.max(0, Math.sin(phase + 1.2)) * 0.9 * amount - 0.05;
  c.shinR.rotation.x = -Math.max(0, Math.sin(phase + 1.2 + Math.PI)) * 0.9 * amount - 0.05;
  // Arms swing opposite to the legs, elbows slightly bent.
  c.armL.rotation.x = -swing * 0.8;
  c.armR.rotation.x = swing * 0.8;
  c.armL.rotation.z = -0.06;
  c.armR.rotation.z = 0.06;
  c.forearmL.rotation.x = 0.25 + Math.max(0, -swing) * 0.4;
  c.forearmR.rotation.x = 0.25 + Math.max(0, swing) * 0.4;
  // The body bobs up twice per stride and sways a little.
  c.hips.position.y = c.hipHeight + Math.abs(Math.cos(phase)) * 0.035 * amount * c.root.scale.y;
  c.hips.rotation.y = Math.sin(phase) * 0.08 * amount;
  c.torso.rotation.y = -Math.sin(phase) * 0.12 * amount;
  c.torso.rotation.x = 0.06 * amount; // lean forward slightly, as if carrying weight
  c.head.rotation.x = -0.04 * amount;
  if (c.ponytail) {
    c.ponytail.rotation.x = 0.5 + Math.cos(phase * 2) * 0.12 * amount;
    c.ponytail.rotation.z = Math.sin(phase) * 0.15 * amount;
  }
}

/** Standing still, breathing gently. `time` in seconds. */
export function poseIdle(c: Character, time: number): void {
  c.thighL.rotation.x = 0.02;
  c.thighR.rotation.x = -0.02;
  c.shinL.rotation.x = -0.04;
  c.shinR.rotation.x = -0.04;
  c.armL.rotation.set(0.05, 0, -0.08);
  c.armR.rotation.set(0.05, 0, 0.08);
  c.forearmL.rotation.x = 0.15;
  c.forearmR.rotation.x = 0.15;
  c.hips.position.y = c.hipHeight;
  c.hips.rotation.y = 0;
  c.torso.rotation.set(Math.sin(time * 1.6) * 0.012, 0, 0);
  c.head.rotation.x = Math.sin(time * 0.7) * 0.03;
  if (c.ponytail) {
    c.ponytail.rotation.x = 0.5;
    c.ponytail.rotation.z = 0;
  }
}

/**
 * Sitting (on a horse or in a truck). `bounce` (radians) adds the rhythm of
 * the ride; `reins` raises the forearms as if holding reins/steering wheel.
 */
export function poseSeated(c: Character, bounce: number, reins: boolean): void {
  c.root.rotation.set(0, 0, 0); // undo poseWounded's tipped-over body if it was used before
  c.thighL.rotation.set(1.35, 0, -0.35);
  c.thighR.rotation.set(1.35, 0, 0.35);
  c.shinL.rotation.x = -1.25;
  c.shinR.rotation.x = -1.25;
  c.armL.rotation.set(reins ? 0.75 : 0.35, 0, -0.1);
  c.armR.rotation.set(reins ? 0.75 : 0.35, 0, 0.1);
  c.forearmL.rotation.x = reins ? 0.7 : 0.9;
  c.forearmR.rotation.x = reins ? 0.7 : 0.9;
  c.hips.position.y = c.hipHeight + Math.abs(Math.sin(bounce)) * 0.03;
  c.hips.rotation.y = 0;
  c.torso.rotation.set(0.04 + Math.sin(bounce * 2) * 0.03, 0, 0);
  c.head.rotation.x = 0;
  if (c.ponytail) {
    c.ponytail.rotation.x = 0.5 + Math.sin(bounce * 2) * 0.1;
    c.ponytail.rotation.z = 0;
  }
}

/**
 * Joel lying wounded ACROSS the horse's back behind Ellie, like in the game's escape
 * from the university: belly on the horse, head and arms hanging down its left side,
 * legs down its right side.
 *
 * How the body is turned (two rotations, applied in this order thanks to 'YXZ'):
 *   1. −90° about X tips the standing figure forward: head points ahead, face down;
 *   2. +90° about Y then swings that lying figure sideways: head points to the
 *      horse's LEFT (−X), feet to its right.
 * In this turned frame, joints that hang DOWN from their pivot (legs, and arms in a
 * standing pose) swing towards the ground with POSITIVE angles; joints that point UP
 * from their pivot (torso, head) need NEGATIVE angles to droop. The values were tuned
 * by measuring joint positions so the body drapes OUTSIDE the horse's flanks.
 * `bounce` (radians) lets the limp body sway with the horse's gait.
 */
export function poseWounded(c: Character, bounce: number): void {
  c.root.rotation.order = 'YXZ';
  c.root.rotation.set(-Math.PI / 2, Math.PI / 2, 0);
  c.hips.position.y = c.hipHeight;
  c.hips.rotation.y = 0;
  const sway = Math.sin(bounce * 2) * 0.05;
  c.torso.rotation.set(-0.7 + sway, 0, 0); // upper body droops over the left flank
  c.head.rotation.set(-0.5, 0.2, 0); // head hanging, turned slightly
  // Arms swung past the head (≈155°) so they dangle towards the ground beside the horse.
  c.armL.rotation.set(2.7 + Math.sin(bounce) * 0.1, 0, -0.2);
  c.armR.rotation.set(2.7 - Math.sin(bounce) * 0.1, 0, 0.2);
  c.forearmL.rotation.x = 0.15;
  c.forearmR.rotation.x = 0.15;
  c.thighL.rotation.set(0.5 - sway, 0, -0.08); // thighs over the right side of the back…
  c.thighR.rotation.set(0.5 - sway, 0, 0.08);
  c.shinL.rotation.x = 1.1; // …and lower legs hanging down the right flank
  c.shinR.rotation.x = 1.1;
  if (c.ponytail) c.ponytail.rotation.set(0.5, 0, 0);
}
