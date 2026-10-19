/**
 * settings.ts — user preferences (map style, terrain, effects).
 *
 * Saved in localStorage so they survive a page reload. localStorage can be
 * unavailable (private windows, blocked storage), so every access is wrapped in
 * try/catch and the app works fine with the defaults.
 *
 * Defaults adapt to the device: on machines with few CPU cores (a rough sign
 * of low power) 3D terrain and particle effects start switched off.
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

/** localStorage key. The "-v1" suffix lets a future version ignore old, incompatible data. */
const STORAGE_KEY = 'tlou-map-settings-v1';

/**
 * Defaults that adapt to the device. `navigator.hardwareConcurrency` = number of CPU
 * threads; 4 or fewer is a rough hint of a low-power machine.
 */
function defaults(): Settings {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  const lowPower = cores <= 4;
  return { mapStyle: 'satellite', terrain: !lowPower, effects: !lowPower };
}

/** Reads saved settings, validating every field (stored data may be old or edited by hand). */
function load(): Settings {
  const base = defaults();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      mapStyle: parsed.mapStyle === 'atlas' || parsed.mapStyle === 'satellite' ? parsed.mapStyle : base.mapStyle,
      terrain: typeof parsed.terrain === 'boolean' ? parsed.terrain : base.terrain,
      effects: typeof parsed.effects === 'boolean' ? parsed.effects : base.effects,
    };
  } catch {
    return base;
  }
}

/** The settings as an external store React can subscribe to (see state/store.ts). */
export class SettingsStore extends Store<Settings> {
  constructor() {
    super(load());
  }

  /** Changes some settings (`Partial` = any subset of the fields) and saves them. */
  update(patch: Partial<Settings>): void {
    this.set(patch);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.getSnapshot()));
    } catch {
      // Storage unavailable: the setting still applies for this visit.
    }
  }
}

/** True if the operating system asks for less motion (an accessibility setting). */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}
