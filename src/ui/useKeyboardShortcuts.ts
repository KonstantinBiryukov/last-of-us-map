/**
 * useKeyboardShortcuts.ts — global keys for the journey.
 *
 *   Space        play / pause the journey
 *   ← / →        previous / next image
 *   Shift + ← →  previous / next chapter
 *   M            play / pause music
 *   F / O        follow the travellers / overview
 *
 * Keys are ignored while the user types in a field or operates a focused
 * control that already uses those keys (a slider uses arrows, a button uses
 * Space), so shortcuts never fight with normal keyboard navigation.
 */
import { useEffect } from 'react';
import type { JourneyRuntime } from '../journey/JourneyContext';

/** True if the key press happened in a field or on a control that uses keys itself. */
function isInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || target.isContentEditable;
}

/**
 * Installs the shortcuts while `enabled` (disabled under the intro/about overlays).
 * The effect's cleanup removes the listener, so there is never more than one.
 */
export function useKeyboardShortcuts(runtime: JourneyRuntime, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const { engine, music, cameraSlot } = runtime;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isInteractive(event.target)) return;
      const director = cameraSlot.getSnapshot().director;
      switch (event.key) {
        case ' ':
          event.preventDefault();
          if (engine.status === 'finished') engine.replay();
          else engine.toggle();
          break;
        case 'ArrowRight':
          event.preventDefault();
          if (event.shiftKey) engine.next();
          else engine.nextSlide();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          if (event.shiftKey) engine.previous();
          else engine.previousSlide();
          break;
        case 'm':
        case 'M':
          music.toggle();
          break;
        case 'f':
        case 'F':
          director?.follow();
          break;
        case 'o':
        case 'O':
          director?.overview();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [runtime, enabled]);
}
