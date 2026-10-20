/**
 * graffiti.ts — the Fireflies' sign, sprayed in red on the hospital's back wall (props.ts).
 *
 * The picture is the game's own graffiti (public/server/assets/other_images/firefly_graffiti.png):
 * the red firefly emblem with its paint drips, cut out of its black background so only the
 * paint is left (the rest of the PNG is fully transparent). It is shown on a flat rectangle
 * (a "decal") just in front of the wall, so it looks painted straight onto it.
 *
 * One texture, one material and one rectangle are shared by every copy, loaded the first time
 * a sign is made (until the picture arrives, the rectangle is simply invisible).
 */
import * as THREE from 'three';
import { assetUrl } from '../config/assets';

/** The cut-out picture, and its proportions (210 × 174 pixels): width ÷ height. */
const PICTURE = 'server/assets/other_images/firefly_graffiti.png';
const ASPECT = 210 / 174;

let shared: { texture: THREE.Texture; material: THREE.MeshLambertMaterial; geometry: THREE.PlaneGeometry } | null = null;

/**
 * A copy of the sign: ASPECT wide and 1 tall, facing +Z (the BACK of a prop — its front is
 * −Z), to be positioned and scaled by the caller. It sits on the wall without flickering
 * (`polygonOffset` pulls it a hair towards the camera in the depth test).
 */
export function fireflySign(): THREE.Mesh {
  if (!shared) {
    const texture = new THREE.TextureLoader().load(assetUrl(PICTURE));
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshLambertMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.05, // the fully transparent background is not drawn at all
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const geometry = new THREE.PlaneGeometry(ASPECT, 1); // a plane faces +Z already
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
