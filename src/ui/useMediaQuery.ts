/** useMediaQuery.ts — true while a CSS media query matches (re-renders when it changes). */
import { useCallback, useSyncExternalStore } from 'react';

/**
 * @param query a CSS media query, e.g. '(max-width: 899px)'
 * `useCallback` keeps the same subscribe function between renders (otherwise React
 * would unsubscribe and resubscribe on every render).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (listener: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', listener);
      return () => list.removeEventListener('change', listener);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}
