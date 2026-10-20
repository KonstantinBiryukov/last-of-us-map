/**
 * graffiti.ts — the Fireflies' sign, sprayed in red paint on the hospital wall (props.ts).
 *
 * The sign is the game's firefly emblem: two pairs of spread wings (a long upper pair angled
 * slightly up, a shorter lower pair angled down), a small round head with two antennae, and a
 * tail of three downward spikes — the middle one longest — with the paint running in drips
 * and a few specks around it, like a quick stencil job.
 *
 * HOW: it is drawn ONCE with the browser's 2D canvas (paths filled in red on a transparent
 * background), turned into a texture, and shown on a flat square (a "decal") just in front of
 * the wall. Only the red shows: everywhere else the texture is fully transparent, so it looks
 * painted straight onto the wall. One texture and one material are shared by every copy.
 */
import * as THREE from 'three';

/** Paint colour: a deep, slightly faded red. */
const INK = '#b3261c';
/** Size of the drawing (pixels). All coordinates below are on a 256 × 256 square. */
const SIZE = 256;

let shared: { texture: THREE.CanvasTexture; material: THREE.MeshLambertMaterial; geometry: THREE.PlaneGeometry } | null = null;

/** Draws the emblem (see the file header) onto a transparent canvas. */
function drawSign(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  const shape = (points: readonly (readonly [number, number])[]) => {
    ctx.beginPath();
    ctx.moveTo(points[0]![0], points[0]![1]);
    for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();
  };
  // Each wing is drawn on the left, then mirrored (x → 256 − x) for the right.
  for (const flip of [false, true]) {
    const m = (points: readonly (readonly [number, number])[]) => points.map(([x, y]) => [flip ? SIZE - x : x, y] as const);
    shape(m([[118, 96], [22, 82], [30, 104], [116, 114]])); // upper wing: long, its tip raised a little
    shape(m([[116, 120], [44, 128], [54, 146], [118, 132]])); // lower wing: shorter, angled down
    shape(m([[120, 136], [100, 182], [110, 184], [126, 142]])); // outer tail spike
  }
  shape([[118, 134], [138, 134], [128, 222]]); // the middle tail spike, the longest
  // The body between the wings, and the head on top of it.
  shape([[114, 94], [142, 94], [140, 138], [116, 138]]);
  ctx.beginPath();
  ctx.arc(128, 88, 13, 0, Math.PI * 2);
  ctx.fill();
  // Antennae: two thin strokes up and out from the head.
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(128 + side * 6, 78);
    ctx.lineTo(128 + side * 20, 54);
    ctx.stroke();
  }
  // The dark drop in the middle of the body (the emblem's "eye"): cut out, so the wall shows.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(128, 100);
  ctx.quadraticCurveTo(138, 116, 128, 126);
  ctx.quadraticCurveTo(118, 116, 128, 100);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // Spray paint: drips running down from the wings, and specks around (fixed positions, so the
  // sign looks the same every time).
  for (const [x, top, length] of [[40, 100, 22], [70, 108, 14], [190, 106, 18], [214, 98, 26], [60, 142, 12], [200, 140, 16]] as const) {
    ctx.fillRect(x - 1.5, top, 3, length);
    ctx.beginPath();
    ctx.arc(x, top + length, 2.5, 0, Math.PI * 2); // the bead at the end of a drip
    ctx.fill();
  }
  for (const [x, y, r] of [[14, 74, 2.5], [236, 70, 2], [242, 92, 3], [20, 118, 2], [160, 60, 2], [92, 58, 1.8], [228, 124, 2.2], [36, 140, 1.6]] as const) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

/**
 * A copy of the sign: a 1 × 1 square facing −Z (the front of a prop), to be positioned and
 * scaled by the caller. It sits on top of the wall without flickering (`polygonOffset` pulls it
 * a hair towards the camera in the depth test).
 */
export function fireflySign(): THREE.Mesh {
  if (!shared) {
    const texture = new THREE.CanvasTexture(drawSign());
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshLambertMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.1, // pixels with almost no paint are not drawn at all (crisp edges)
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const geometry = new THREE.PlaneGeometry(1, 1).rotateY(Math.PI); // a plane faces +Z; turn it to face −Z
    shared = { texture, material, geometry };
  }
  const mesh = new THREE.Mesh(shared.geometry, shared.material);
  mesh.frustumCulled = false; // the map supplies the projection (as for every other part)
  return mesh;
}

/** Frees the sign's texture, material and geometry (when the 3D layer is removed). */
export function disposeGraffiti(): void {
  if (!shared) return;
  shared.texture.dispose();
  shared.material.dispose();
  shared.geometry.dispose();
  shared = null;
}
