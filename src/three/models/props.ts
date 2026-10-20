/**
 * props.ts — small blockmesh "dioramas" that mark each chapter's key points beside the
 * route (a museum front for "The Museum", stacked containers for "The Cargo", …).
 *
 * Same style as the characters, horse and truck: simple boxes, cylinders, cones and
 * prisms, flat-shaded with the shared palette (materials.ts), so geometry and materials
 * are created once and shared. Every prop stands on a dark ground pad (with a deep plinth
 * below it, hidden in the ground) so it reads as one object on top of the satellite photo.
 *
 * Units are model metres at the characters' scale (Joel ≈ 1.85 m), so a house is ~3 m tall
 * — a miniature next to the travellers, like a board-game piece. The layer gives each prop
 * one fixed real-world size: the travellers' size where they pass it.
 *
 * Orientation: each prop's FRONT faces −Z; the layer turns it so the front faces the route.
 * `radius` (data/keyPoints.ts, PROP_RADIUS) is how far the prop reaches from its centre, so
 * it can stand beside the path without the travellers walking through it.
 */
import * as THREE from 'three';
import type { PropKind } from '../../data/types';
import { PROP_RADIUS } from '../../data/keyPoints';
import { part, type PaletteKey } from '../materials';
import { createCharacter, MARIA, poseIdle, TOMMY } from './character';

export interface Prop {
  root: THREE.Group;
  /** Half the prop's largest footprint size (model metres). */
  radius: number;
}

// ───────────────────────── tiny building blocks ─────────────────────────
// Each adds one shape to group `g`. `y` is where the shape's BOTTOM sits (not its centre),
// which makes stacking easy: a roof on a 2 m wall goes at y = 2.

/** A box w × h × d (x × y × z) standing on y. */
function box(g: THREE.Group, w: number, h: number, d: number, mat: PaletteKey, x = 0, y = 0, z = 0): THREE.Mesh {
  // One shared unit cube, stretched with `scale`: every box shares the same geometry.
  const mesh = part('prop-box', () => new THREE.BoxGeometry(1, 1, 1), mat, x, y + h / 2, z);
  mesh.scale.set(w, h, d);
  g.add(mesh);
  return mesh;
}

/** A cylinder (radius r, height h) standing on y; `top` scales the top radius (cone-ish). */
function cyl(g: THREE.Group, r: number, h: number, mat: PaletteKey, x = 0, y = 0, z = 0, top = 1, segments = 8): THREE.Mesh {
  const mesh = part(`prop-cyl-${top}-${segments}`, () => new THREE.CylinderGeometry(0.5 * top, 0.5, 1, segments), mat, x, y + h / 2, z);
  mesh.scale.set(r * 2, h, r * 2);
  g.add(mesh);
  return mesh;
}

/** A four-sided pyramid roof w × h × d standing on y. */
function hipRoof(g: THREE.Group, w: number, h: number, d: number, mat: PaletteKey, x = 0, y = 0, z = 0): void {
  // A 4-segment cone turned 45° is a square pyramid of width 1 (radius √½).
  const mesh = part('prop-pyramid', () => new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4), mat, x, y + h / 2, z);
  mesh.scale.set(w, h, d);
  g.add(mesh);
}

/**
 * A gable (ridge) roof: a triangular prism, ridge along x, w long, d deep, h high, on y.
 * Built from a 3-sided cylinder laid on its side with the point up (see the rotations):
 * its triangle is 0.866 wide and 0.75 tall, so we scale by d/0.866 and h/0.75.
 */
function gableRoof(g: THREE.Group, w: number, h: number, d: number, mat: PaletteKey, x = 0, y = 0, z = 0): void {
  const mesh = part(
    'prop-prism',
    () => new THREE.CylinderGeometry(0.5, 0.5, 1, 3).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).translate(0, 0.25, 0),
    mat,
    x,
    y,
    z,
  );
  mesh.scale.set(w, h / 0.75, d / 0.866);
  g.add(mesh);
}

/** A row of dark windows along a wall's front (−Z) face. */
function windows(g: THREE.Group, count: number, width: number, y: number, z: number, x = 0, size = 0.32): void {
  for (let i = 0; i < count; i++) {
    const wx = x - width / 2 + (width / count) * (i + 0.5);
    box(g, size, size, 0.04, 'windowDark', wx, y, z);
  }
}

/** A simple low-poly tree: trunk and a cone or a lumpy crown. */
function tree(g: THREE.Group, x: number, z: number, height = 1.8, conifer = true): void {
  cyl(g, 0.09, height * 0.35, 'trunk', x, 0, z, 1, 5);
  if (conifer) cyl(g, height * 0.28, height * 0.75, 'leafDark', x, height * 0.25, z, 0, 6);
  else box(g, height * 0.5, height * 0.45, height * 0.5, 'leaf', x, height * 0.35, z);
}

/** A small house: walls, gable roof, door and two windows. */
function house(g: THREE.Group, x: number, z: number, w = 2, d = 1.6, h = 1.3, wall: PaletteKey = 'plaster', roof: PaletteKey = 'roofRed'): void {
  box(g, w, h, d, wall, x, 0, z);
  gableRoof(g, w + 0.2, 0.8, d + 0.2, roof, x, h, z);
  box(g, 0.36, 0.7, 0.04, 'woodDark', x, 0, z - d / 2 - 0.01);
  windows(g, 2, w * 0.8, h * 0.45, z - d / 2 - 0.01, x);
}

/**
 * How far the dark base reaches BELOW the ground (model metres). The prop stands on the
 * highest point under it (three/keyPoints.ts); on a slope the lower sides of the base then
 * disappear into the hillside instead of leaving a gap or a sunken prop.
 */
const PLINTH_DEPTH = 2.5;

/** The dark base every prop stands on (w × d): a thin pad on top of a deep plinth. */
function pad(g: THREE.Group, w: number, d: number): void {
  box(g, w, 0.06 + PLINTH_DEPTH, d, 'groundPad', 0, -PLINTH_DEPTH - 0.03, 0);
}

// ───────────────────────── the props ─────────────────────────

const BUILDERS: Record<PropKind, (g: THREE.Group) => void> = {
  // Joel and Sarah's house in Austin, with an attached garage and a driveway. The FRONT (−Z)
  // faces the street — the route — and the garage door is centred on it, so the travellers'
  // truck, which starts at the very first point of the route right in front of this prop,
  // stands OUTSIDE the garage at the end of the driveway, ready to leave (as in the game).
  house: (g) => {
    pad(g, 3.8, 3);
    box(g, 1.2, 1.0, 1.5, 'plaster', 0.15, 0, 0.35); // garage, door to the front (centred)
    gableRoof(g, 1.3, 0.5, 1.6, 'roofDark', 0.15, 1.0, 0.35);
    box(g, 0.95, 0.75, 0.04, 'offWhite', 0.15, 0, -0.41); // garage door
    for (let y = 0.18; y < 0.75; y += 0.18) box(g, 0.95, 0.02, 0.05, 'concrete', 0.15, y, -0.42); // door panels
    box(g, 1.0, 0.03, 1.1, 'asphalt', 0.15, 0, -1.0); // driveway out to the street
    house(g, -1.2, 0.3, 1.6, 1.7, 1.4, 'plaster', 'roofDark'); // the house beside it
    box(g, 1.6, 0.08, 0.5, 'wood', -1.2, 0.35, -0.7); // porch
    tree(g, 1.45, 0.9, 1.9, false);
  },
  // A Quarantine Zone checkpoint: wall segment with a gate and a watchtower.
  checkpoint: (g) => {
    pad(g, 4.4, 2);
    box(g, 1.5, 1.6, 0.4, 'concrete', -1.35, 0, 0);
    box(g, 1.5, 1.6, 0.4, 'concrete', 1.35, 0, 0);
    box(g, 1.2, 0.18, 0.5, 'metal', 0, 1.42, 0); // gate beam
    for (const [x, z] of [[1.6, 0.6], [2.0, 0.6], [1.6, 1.0], [2.0, 1.0]] as const) box(g, 0.08, 2.2, 0.08, 'woodDark', x, 0, z);
    box(g, 0.8, 0.5, 0.8, 'wood', 1.8, 2.2, 0.8); // tower cabin
    hipRoof(g, 1, 0.35, 1, 'roofDark', 1.8, 2.7, 0.8);
  },
  // Patched shacks with corrugated roofs.
  slums: (g) => {
    pad(g, 4, 3);
    box(g, 1.3, 1.0, 1.1, 'rust', -1.1, 0, -0.4);
    box(g, 1.5, 0.08, 1.3, 'metal', -1.1, 1.0, -0.4);
    box(g, 1.1, 0.85, 1.0, 'woodDark', 0.4, 0, 0.5);
    box(g, 1.3, 0.08, 1.2, 'rust', 0.4, 0.85, 0.5);
    box(g, 1.0, 1.15, 0.9, 'concreteDark', 1.3, 0, -0.6);
    box(g, 1.2, 0.08, 1.1, 'metal', 1.3, 1.15, -0.6);
  },
  // Stacked shipping containers.
  cargo: (g) => {
    pad(g, 3.8, 2.4);
    box(g, 2.4, 0.95, 0.95, 'containerRed', -0.5, 0, -0.5);
    box(g, 2.4, 0.95, 0.95, 'containerBlue', -0.5, 0, 0.5);
    box(g, 2.4, 0.95, 0.95, 'containerGreen', -0.3, 0.95, 0);
    box(g, 0.95, 0.95, 2.0, 'containerRed', 1.35, 0, 0);
  },
  // A tall concrete wall with a breach.
  wall: (g) => {
    pad(g, 4.4, 1.4);
    box(g, 1.7, 2.2, 0.45, 'concrete', -1.25, 0, 0);
    box(g, 1.4, 2.2, 0.45, 'concrete', 1.4, 0, 0);
    box(g, 0.9, 0.7, 0.45, 'concreteDark', 0.15, 0, 0); // the broken bit
    box(g, 0.5, 0.3, 0.5, 'concreteDark', 0.4, 0, -0.6); // rubble
    box(g, 0.35, 0.25, 0.35, 'concreteDark', -0.2, 0, -0.7);
  },
  // A small wood: a few conifers and a broadleaf tree.
  trees: (g) => {
    pad(g, 3.4, 3);
    tree(g, -0.9, -0.5, 2.3);
    tree(g, 0.6, -0.8, 1.9);
    tree(g, 0.2, 0.7, 2.6);
    tree(g, -1.1, 0.9, 1.6, false);
    tree(g, 1.2, 0.5, 1.7);
  },
  // Downtown: three high-rises of different heights.
  towers: (g) => {
    pad(g, 3.6, 3);
    for (const [w, h, x, z, mat] of [
      [1.1, 4.2, -0.9, 0.2, 'concrete'],
      [1.0, 5.6, 0.4, -0.4, 'concreteDark'],
      [0.9, 3.2, 1.2, 0.8, 'brick'],
    ] as const) {
      box(g, w, h, w, mat, x, 0, z);
      for (let y = 0.5; y < h - 0.3; y += 0.6) box(g, w * 0.8, 0.14, 0.04, 'windowDark', x, y, z - w / 2 - 0.01);
    }
  },
  // A columned museum front with a pediment.
  museum: (g) => {
    pad(g, 4, 2.8);
    box(g, 3.2, 0.3, 2.2, 'stone', 0, 0, 0); // steps
    box(g, 3.0, 1.7, 1.4, 'stone', 0, 0.3, 0.3);
    for (let i = 0; i < 5; i++) cyl(g, 0.11, 1.5, 'offWhite', -1.2 + i * 0.6, 0.3, -0.6, 1, 8);
    box(g, 3.1, 0.2, 0.5, 'offWhite', 0, 1.8, -0.55);
    gableRoof(g, 3.1, 0.5, 2.0, 'stone', 0, 2.0, 0);
  },
  // The Massachusetts State House: red-brick front with a white columned portico, a drum,
  // its famous GOLD dome and a lantern on top. Its middle is left open (the travellers walk
  // into it at the end of the Boston walk — see `enter` in data/keyPoints.ts).
  capitol: (g) => {
    pad(g, 4.4, 3.2);
    box(g, 1.3, 1.5, 2.2, 'brick', -1.45, 0, 0.3); // west wing
    box(g, 1.3, 1.5, 2.2, 'brick', 1.45, 0, 0.3); // east wing
    box(g, 1.6, 1.5, 1.6, 'brick', 0, 0, 0.6); // centre block (behind the portico)
    box(g, 4.2, 0.12, 2.3, 'offWhite', 0, 1.5, 0.3); // white cornice along the top
    // Portico: two storeys of white columns, arches below, a triangular pediment above.
    box(g, 1.8, 0.5, 0.7, 'offWhite', 0, 0, -0.45);
    for (let i = 0; i < 6; i++) cyl(g, 0.07, 1.0, 'offWhite', -0.75 + i * 0.3, 0.5, -0.55, 1, 6);
    box(g, 1.9, 0.12, 0.8, 'offWhite', 0, 1.5, -0.45);
    gableRoof(g, 1.9, 0.35, 0.8, 'offWhite', 0, 1.62, -0.45);
    // The dome: a white drum, the gold dome, a lantern and its pine-cone finial.
    cyl(g, 0.62, 0.45, 'offWhite', 0, 1.62, 0.6, 1, 12);
    const dome = part('prop-dome', () => new THREE.SphereGeometry(0.5, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), 'gold', 0, 2.07, 0.6);
    dome.scale.set(1.25, 1.1, 1.25);
    g.add(dome);
    cyl(g, 0.16, 0.3, 'offWhite', 0, 2.6, 0.6, 1, 8);
    cyl(g, 0.12, 0.22, 'gold', 0, 2.9, 0.6, 0, 6);
  },
  // Bill's boarded-up safehouse behind a fence.
  safehouse: (g) => {
    pad(g, 3.6, 3);
    house(g, 0, 0.3, 2.2, 1.7, 1.3, 'woodDark', 'roofDark');
    box(g, 0.5, 0.08, 0.06, 'wood', -0.5, 0.65, -0.6); // boards over the windows
    box(g, 0.5, 0.08, 0.06, 'wood', 0.5, 0.75, -0.6);
    for (let x = -1.6; x <= 1.6; x += 0.4) box(g, 0.08, 0.6, 0.08, 'wood', x, 0, -1.3);
    box(g, 3.3, 0.06, 0.06, 'wood', 0, 0.45, -1.3);
  },
  // Headstones and a cross next to a little chapel.
  graveyard: (g) => {
    pad(g, 3.8, 3);
    box(g, 1.2, 1.3, 1.4, 'stone', 1.1, 0, 0.6);
    gableRoof(g, 1.4, 0.6, 1.4, 'roofDark', 1.1, 1.3, 0.6);
    box(g, 0.1, 0.9, 0.1, 'stone', 1.1, 1.9, 0.6);
    box(g, 0.4, 0.1, 0.1, 'stone', 1.1, 2.5, 0.6);
    for (const [x, z] of [[-1.3, -0.8], [-0.6, -0.8], [0.1, -0.8], [-1.3, 0.1], [-0.6, 0.1], [-1.0, 0.9]] as const) {
      box(g, 0.35, 0.45, 0.1, 'stone', x, 0, z);
    }
  },
  // A long school building with a flagpole.
  school: (g) => {
    pad(g, 4.4, 2.8);
    box(g, 3.8, 1.4, 1.6, 'brick', 0, 0, 0.3);
    box(g, 3.9, 0.12, 1.7, 'roofDark', 0, 1.4, 0.3);
    windows(g, 6, 3.4, 0.6, -0.51);
    box(g, 0.6, 0.9, 0.05, 'woodDark', 0, 0, -0.52);
    cyl(g, 0.04, 2.6, 'metal', 1.9, 0, -1.0, 1, 5);
    box(g, 0.5, 0.3, 0.03, 'containerBlue', 2.15, 2.2, -1.0);
  },
  // A tall hotel with a sign on the roof.
  hotel: (g) => {
    pad(g, 3, 3);
    box(g, 2.0, 4.4, 1.6, 'plaster', 0, 0, 0);
    for (let y = 0.6; y < 4.1; y += 0.6) windows(g, 4, 1.7, y, -0.81);
    box(g, 0.8, 0.7, 0.05, 'windowDark', 0, 0, -0.82); // lobby doors
    box(g, 1.6, 0.45, 0.1, 'crossRed', 0, 4.5, -0.2); // rooftop sign
    box(g, 0.06, 0.2, 0.06, 'metal', -0.6, 4.4, -0.2);
    box(g, 0.06, 0.2, 0.06, 'metal', 0.6, 4.4, -0.2);
  },
  // The Roberto Clemente Bridge, one of Pittsburgh's yellow "Three Sisters": a self-anchored
  // suspension bridge. Deck along the Z axis (its length), two pairs of yellow towers, and
  // the chains drawn as straight links sagging between the tower tops and down to the deck
  // ends. No ground pad: it spans the river (the real water is on the satellite photo below).
  //
  // The deck lies AT GROUND LEVEL: its top is at y = −0.06, which the layer's small lift above
  // the ground (LIFT = 0.08 in three/keyPoints.ts) brings to just above the ground — so the
  // travellers crossing it walk ON the roadway, not through a deck floating at waist height.
  bridge: (g) => {
    const deckTop = -0.06;
    box(g, 0.9, 0.14, 4.6, 'asphalt', 0, deckTop - 0.14, 0); // roadway
    box(g, 1.0, 0.08, 4.6, 'bridgeYellow', 0, deckTop - 0.22, 0); // yellow girders under it
    const towerTop = deckTop + 1.3;
    for (const x of [-0.5, 0.5]) {
      for (const z of [-1.1, 1.1]) box(g, 0.1, towerTop - deckTop, 0.12, 'bridgeYellow', x, deckTop, z);
      // Chain links: (z, height) points along the sagging curve; each pair joined by a thin box.
      const curve: [number, number][] = [
        [-2.3, deckTop + 0.15], [-1.7, deckTop + 0.55], [-1.1, towerTop],
        [-0.55, deckTop + 0.6], [0, deckTop + 0.35], [0.55, deckTop + 0.6],
        [1.1, towerTop], [1.7, deckTop + 0.55], [2.3, deckTop + 0.15],
      ];
      for (let i = 1; i < curve.length; i++) {
        const [z0, y0] = curve[i - 1]!;
        const [z1, y1] = curve[i]!;
        const length = Math.hypot(z1 - z0, y1 - y0);
        const link = box(g, 0.06, length, 0.06, 'bridgeYellow', x, 0, (z0 + z1) / 2);
        // Stand the link up between the two points: centre it, then tilt it about X.
        link.position.y = (y0 + y1) / 2;
        link.rotation.x = Math.atan2(z1 - z0, y1 - y0);
      }
      // Vertical hangers from the chain down to the deck.
      for (const [z, y] of [[-1.7, deckTop + 0.55], [-0.55, deckTop + 0.6], [0.55, deckTop + 0.6], [1.7, deckTop + 0.55]] as const) {
        box(g, 0.025, y - deckTop, 0.025, 'bridgeYellow', x, deckTop, z);
      }
    }
  },
  // A sewer outlet: a pipe mouth in a concrete wall over dark water.
  sewer: (g) => {
    pad(g, 3, 2.2);
    box(g, 2.8, 1.6, 0.6, 'concreteDark', 0, 0, 0.4);
    const pipe = part('prop-pipe', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 10).rotateX(Math.PI / 2), 'concrete', 0, 0.75, -0.1);
    pipe.scale.set(1.1, 1.1, 0.6);
    g.add(pipe);
    const mouth = part('prop-pipe', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 10).rotateX(Math.PI / 2), 'windowDark', 0, 0.75, -0.42);
    mouth.scale.set(0.85, 0.85, 0.05);
    g.add(mouth);
    box(g, 1.6, 0.1, 0.9, 'water', 0, 0.04, -0.8); // sits clearly on the base (no flicker against it)
  },
  // Two suburban houses with a picket fence.
  suburb: (g) => {
    pad(g, 4.6, 3);
    house(g, -1.2, 0.3, 1.8, 1.5, 1.2, 'plaster', 'roofRed');
    house(g, 1.2, 0.4, 1.7, 1.4, 1.1, 'offWhite', 'roofDark');
    for (let x = -2.1; x <= 2.1; x += 0.35) box(g, 0.06, 0.35, 0.06, 'offWhite', x, 0, -1.2);
    box(g, 4.3, 0.05, 0.05, 'offWhite', 0, 0.25, -1.2);
  },
  // Tommy's hydroelectric dam: a curved wall holding back water, a spillway and a hut.
  dam: (g) => {
    pad(g, 4.8, 3.2);
    box(g, 4.4, 0.4, 1.4, 'water', 0, 0, 0.8); // the reservoir behind
    for (let i = 0; i < 5; i++) {
      const block = box(g, 1.0, 1.8, 0.6, 'concrete', -1.8 + i * 0.9, 0, -0.1 - Math.abs(i - 2) * 0.12);
      block.rotation.y = (i - 2) * 0.12; // a gentle arch
    }
    box(g, 0.6, 1.0, 0.05, 'water', 0, 0.2, -0.55); // spillway
    box(g, 0.8, 0.6, 0.6, 'plaster', 1.6, 1.8, 0);
    // The pool below the spillway and the wooden pallet floating in it — the raft Ellie, who
    // cannot swim, is pushed across on at the dam. Murky water (darker than the reservoir) with
    // white foam where the spillway pours in. The pallet is a real shipping pallet: seven
    // weathered, sun-bleached deck boards with gaps between them, on three thick runners; it
    // floats low (runners under the surface) and tilts a little, as if bobbing in the current.
    box(g, 2.8, 0.1, 0.95, 'waterDark', -0.55, 0.04, -1.1);
    for (const [fx, fz, fw] of [[0, -0.7, 0.5], [0.25, -0.85, 0.25], [-0.3, -0.8, 0.3], [-1.6, -1.45, 0.35]] as const) {
      box(g, fw, 0.02, fw * 0.45, 'offWhite', fx, 0.14, fz); // foam
    }
    const raft = new THREE.Group();
    raft.position.set(-0.75, 0.12, -1.1);
    raft.rotation.set(0.06, 0.32, -0.05); // drifting: turned, and tipped a little
    for (const x of [-0.42, 0, 0.42]) box(raft, 0.12, 0.09, 0.82, 'palletWoodDark', x, -0.06, 0); // runners (mostly under water)
    for (let i = 0; i < 7; i++) {
      const length = 1.0 - (i % 3 === 1 ? 0.06 : 0); // slightly uneven boards
      box(raft, length, 0.035, 0.09, i % 2 === 0 ? 'palletWood' : 'palletWoodLight', 0, 0.03, -0.36 + i * 0.12); // deck boards
    }
    g.add(raft);
    // Tommy and his wife Maria, standing in front of the dam to meet Joel and Ellie. They do
    // not travel: they are part of this prop. The same blocky characters as the travellers, at
    // ~0.9 so they match the travellers' size (props are drawn a little larger than them).
    for (const [look, x, turn] of [
      [TOMMY, 1.25, 0.15],
      [MARIA, 1.85, -0.35],
    ] as const) {
      const person = createCharacter(look);
      poseIdle(person, 0); // a relaxed standing pose, held (story time does not move it)
      person.root.position.set(x, 0, -1.2);
      person.root.rotation.y = turn; // facing the route, Maria turned a little towards Tommy
      person.root.scale.setScalar(0.9);
      g.add(person.root);
    }
  },
  // A ranch house and a red barn.
  ranch: (g) => {
    pad(g, 4.6, 3);
    house(g, -1.1, 0.2, 2.0, 1.5, 1.2, 'wood', 'roofDark');
    box(g, 1.6, 1.5, 1.6, 'roofRed', 1.3, 0, 0.4);
    gableRoof(g, 1.8, 0.8, 1.7, 'roofDark', 1.3, 1.5, 0.4);
    box(g, 0.7, 0.9, 0.04, 'offWhite', 1.3, 0, -0.42);
    for (let x = -2.1; x <= 0.2; x += 0.45) box(g, 0.07, 0.45, 0.07, 'wood', x, 0, -1.2);
    box(g, 2.4, 0.06, 0.06, 'wood', -0.95, 0.35, -1.2);
  },
  // The University of Eastern Colorado: a hall with a banner (the Big Horns).
  campus: (g) => {
    pad(g, 4.2, 3);
    box(g, 3.4, 1.8, 1.6, 'brick', 0, 0, 0.3);
    gableRoof(g, 3.5, 0.6, 1.7, 'roofDark', 0, 1.8, 0.3);
    box(g, 0.8, 2.6, 0.8, 'brick', 0, 0, 0.3); // clock tower
    hipRoof(g, 0.9, 0.7, 0.9, 'roofDark', 0, 2.6, 0.3);
    windows(g, 6, 3.0, 0.9, -0.51);
    box(g, 0.6, 1.0, 0.04, 'crossRed', 1.3, 0.5, -0.53); // the Big Horns banner
  },
  // The science building: a flat block with a rooftop dish and vents.
  lab: (g) => {
    pad(g, 3.8, 3);
    box(g, 3.0, 2.0, 2.0, 'concrete', 0, 0, 0.2);
    for (let y = 0.4; y < 1.9; y += 0.55) windows(g, 5, 2.6, y, -0.81);
    box(g, 0.5, 0.4, 0.5, 'metal', -0.8, 2.0, 0.5);
    const dish = part('prop-dish', () => new THREE.SphereGeometry(0.5, 10, 4, 0, Math.PI * 2, 0, Math.PI / 3), 'offWhite', 0.7, 2.6, 0.3);
    dish.rotation.x = Math.PI * 0.75; // tilted up at the sky
    dish.scale.setScalar(1.2);
    g.add(dish);
    cyl(g, 0.06, 0.6, 'metal', 0.7, 2.0, 0.3);
  },
  // Lakeside resort: two cabins and pines by the water.
  cabins: (g) => {
    pad(g, 4.4, 3);
    box(g, 1.8, 0.1, 1.0, 'water', 1.2, 0.04, 0.9); // the lake/pool, clearly on top of the base
    house(g, -1.0, -0.2, 1.5, 1.3, 1.0, 'wood', 'roofDark');
    house(g, 0.9, -0.5, 1.3, 1.1, 0.9, 'woodDark', 'roofDark');
    tree(g, -1.8, 1.0, 2.1);
    tree(g, -0.4, 1.1, 1.7);
  },
  // St. Mary's Hospital: a tall white block with a red cross.
  hospital: (g) => {
    pad(g, 3.6, 3);
    box(g, 2.6, 3.4, 1.8, 'offWhite', 0, 0, 0.2);
    box(g, 1.2, 1.2, 1.0, 'offWhite', 1.6, 0, 0.3);
    for (let y = 0.5; y < 3.2; y += 0.6) windows(g, 4, 2.2, y, -0.71);
    box(g, 0.8, 0.22, 0.06, 'crossRed', 0, 3.6, -0.5);
    box(g, 0.22, 0.8, 0.06, 'crossRed', 0, 3.31, -0.5);
  },
  // The giraffe of Salt Lake City: blocky, patched, neck stretched forward and up.
  giraffe: (root) => {
    pad(root, 2.2, 2.0);
    // Built at full size, then scaled to 75 % so it stays clearly shorter than the hospital.
    const g = new THREE.Group();
    g.scale.setScalar(0.75);
    root.add(g);
    for (const [lx, lz] of [[-0.25, -0.45], [0.25, -0.45], [-0.25, 0.45], [0.25, 0.45]] as const) {
      box(g, 0.16, 1.3, 0.16, 'giraffeTan', lx, 0, lz);
      box(g, 0.17, 0.12, 0.17, 'hoof', lx, 0, lz);
    }
    box(g, 0.75, 0.6, 1.3, 'giraffeTan', 0, 1.25, 0); // body (top at 1.85, front at z −0.65)
    // The neck: 1.5 long, centred at (0, 2.3, −0.55), leaning FORWARD by 0.35 rad (a negative
    // x-rotation tips its top towards −z). Its top end then sits at about (0, 3.0, −0.81) —
    // inside the head below — and its bottom end at (0, 1.6, −0.29), inside the body.
    const neck = box(g, 0.26, 1.5, 0.3, 'giraffeTan', 0, 1.55, -0.55);
    neck.rotation.x = -0.35;
    box(g, 0.3, 0.3, 0.55, 'giraffeTan', 0, 2.88, -0.95); // head (y 2.88–3.18, z −1.22…−0.67)
    box(g, 0.05, 0.18, 0.05, 'giraffeSpot', -0.08, 3.18, -0.82); // ossicones
    box(g, 0.05, 0.18, 0.05, 'giraffeSpot', 0.08, 3.18, -0.82);
    // Patches: small darker squares just proud of the body.
    for (const [px, py, pz] of [[0.38, 1.6, -0.3], [0.38, 1.4, 0.25], [-0.38, 1.55, 0.05], [-0.38, 1.35, -0.4], [0, 1.86, 0.3]] as const) {
      box(g, px === 0 ? 0.3 : 0.02, px === 0 ? 0.02 : 0.2, 0.25, 'giraffeSpot', px, py, pz);
    }
  },
  // Jackson: a wooden palisade gate with houses behind.
  town: (g) => {
    pad(g, 4.6, 3.2);
    for (let x = -2.1; x <= 2.1; x += 0.3) {
      if (Math.abs(x) < 0.5) continue; // the gate opening
      cyl(g, 0.13, 1.6, 'wood', x, 0, -1.0, 0.7, 5);
    }
    box(g, 1.2, 0.25, 0.3, 'woodDark', 0, 1.5, -1.0); // gate beam
    house(g, -1.0, 0.6, 1.6, 1.3, 1.1, 'wood', 'roofDark');
    house(g, 1.1, 0.8, 1.5, 1.2, 1.0, 'plaster', 'roofRed');
  },
};

/** Builds a fresh prop of the given kind. */
export function createProp(kind: PropKind): Prop {
  const root = new THREE.Group();
  root.name = `prop-${kind}`;
  BUILDERS[kind](root);
  return { root, radius: PROP_RADIUS[kind] };
}
