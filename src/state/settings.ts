/**
 * settings.ts — the map's display settings (map style, terrain, effects).
 *
 * These are the app's own choices, not the user's: there is no settings menu. Satellite
 * imagery always; 3D terrain and particle effects on, except on machines with few CPU cores
 * (a rough sign of low power), where both start switched off to keep the journey smooth.
 * Nothing is saved: choices stored by older versions of the app are ignored.
 */
import { Store } from './store';

/** Which base map to show: real satellite imagery or a muted cartographic map. */
export type MapStyleId = 'satellite' | 'atlas';

/** The user's preferences. */
export interface Settings {
  /** Base map style. */
  mapStyle: MapStyleId;
  /** 3D mountains (costs GPU time). */
  terrain: boolean;
  /** Dust and seasonal particles. */
  effects: boolean;
}

/**
 * Defaults that adapt to the device. `navigator.hardwareConcurrency` = number of CPU
 * threads; 4 or fewer is a rough hint of a low-power machine.
 */
function defaults(): Settings {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  const lowPower = cores <= 4;
  return { mapStyle: 'satellite', terrain: !lowPower, effects: !lowPower };
}

/** The settings as an external store React can subscribe to (see state/store.ts). */
export class SettingsStore extends Store<Settings> {
  constructor() {
    super(defaults());
  }

  /** Changes some settings (`Partial` = any subset of the fields) for this visit. */
  update(patch: Partial<Settings>): void {
    this.set(patch);
  }
}

/** True if the operating system asks for less motion (an accessibility setting). */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}
