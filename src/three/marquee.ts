/**
 * marquee.ts — the glowing marquee of the old theatre (props.ts: `theatre`), as on the game's
 * outbreak night, but deliberately WORDLESS (more obscure): a dark board edged with bulbs, a
 * red neon tube with a star, and below it a plain lit white panel. No text or letter-like
 * marks anywhere.
 *
 * HOW: drawn ONCE with the browser's 2D canvas, turned into a texture and shown on a flat
 * rectangle on the front of the marquee. Its material ignores the scene's lights (it IS a light:
 * MeshBasicMaterial), so it glows the same in the night of the prologue. One texture, one
 * material and one rectangle are shared by every copy.
 */
import * as THREE from 'three';

/** The drawing's size in pixels: 4 : 1.2, the marquee board's proportions. */
const WIDTH = 640;
const HEIGHT = 192;

let shared: { texture: THREE.CanvasTexture; material: THREE.MeshBasicMaterial; geometry: THREE.PlaneGeometry } | null = null;

/** Draws the marquee (see the file header). */
function drawMarquee(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;
  // The board: near-black, with a thin warm frame of bulbs along its edge.
  ctx.fillStyle = '#17110f';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#ffd9a0';
  for (let x = 10; x < WIDTH; x += 20) {
    for (const y of [6, HEIGHT - 6]) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // No readable words — just the impression of a theatre sign: a red neon tube running along
  // the board (a bright core with a soft red glow, shadowBlur) with a star in the middle …
  ctx.shadowColor = '#ff2a1a';
  ctx.shadowBlur = 16;
  ctx.strokeStyle = '#ffb3a6';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  for (const [x0, x1] of [[48, 270], [370, 592]] as const) {
    ctx.beginPath();
    ctx.moveTo(x0, 56);
    ctx.lineTo(x1, 56);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffd0c4';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 24 : 10; // a five-pointed star: outer and inner corners in turn
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(WIDTH / 2 + Math.cos(a) * r, 56 + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  // … and the show board below: just a plain lit white panel — no letters, no marks at all.
  ctx.fillStyle = '#f4efe2';
  ctx.fillRect(40, 102, WIDTH - 80, 76);
  return canvas;
}

/**
 * A copy of the marquee's face: 1 wide and 0.3 tall, facing −Z (the front of a prop), to be
 * positioned and scaled by the caller.
 */
export function marqueeFace(): THREE.Mesh {
  if (!shared) {
    const texture = new THREE.CanvasTexture(drawMarquee());
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    const geometry = new THREE.PlaneGeometry(1, HEIGHT / WIDTH).rotateY(Math.PI); // a plane faces +Z; turn it to face −Z
    shared = { texture, material, geometry };
  }
  const mesh = new THREE.Mesh(shared.geometry, shared.material);
  mesh.frustumCulled = false; // the map supplies the projection (as for every other part)
  return mesh;
}

/** Frees the marquee's texture, material and geometry (when the 3D layer is removed). */
export function disposeMarquee(): void {
  if (!shared) return;
  shared.texture.dispose();
  shared.material.dispose();
  shared.geometry.dispose();
  shared = null;
}
