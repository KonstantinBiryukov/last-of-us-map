/**
 * store.ts — a tiny "external store" helper for React.
 *
 * React's `useSyncExternalStore` hook can read state that lives OUTSIDE React
 * (in a plain object), and re-render components only when that state changes.
 * This helper gives any class the two methods that hook needs:
 *   getSnapshot() – returns the current state object (same object until it changes);
 *   subscribe()   – lets React know when to read again.
 */
export class Store<T extends object> {
  /** The current state object. Replaced (never mutated) so React can detect changes with ===. */
  private state: T;
  /** Callbacks to run after every change (React's re-render triggers). */
  private listeners = new Set<() => void>();

  constructor(initial: T) {
    this.state = initial;
  }

  /** Current state. An arrow property so it can be passed to React without losing `this`. */
  getSnapshot = (): T => this.state;

  /** Register a change callback; returns the function that removes it. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Merge a partial update; notifies listeners only if something really changed. */
  protected set(patch: Partial<T>): void {
    let changed = false;
    for (const key of Object.keys(patch) as (keyof T)[]) {
      if (!Object.is(this.state[key], patch[key])) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }
}
