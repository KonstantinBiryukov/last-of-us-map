/**
 * useHashRoute.ts — minimal hash-based routing.
 *
 * GitHub Pages can only serve real files, so a URL like /last-of-us-map/about
 * would 404. Everything after "#" is never sent to the server, so hash URLs
 * (/last-of-us-map/#/about) always load index.html and work when opened
 * directly. The original Vue app used the same scheme, so all old links keep
 * working:
 *
 *   #/            → title screen (the production URL)
 *   #/path        → the journey, playing   (old "Follow the path" mode)
 *   #/map         → the map, free exploration (old "Interactive map" mode)
 *   #/about       → about & credits
 *   #/chapter/7   → deep link: start at chapter 7
 *
 * Only ~30 lines, so no router library is needed.
 */
import { useCallback, useSyncExternalStore } from 'react';

/** The screens the URL can point to. */
export type AppRoute =
  | { name: 'intro' }
  | { name: 'journey' }
  | { name: 'explore' }
  | { name: 'about' }
  | { name: 'chapter'; chapterNumber: number };

/**
 * Turns "#/chapter/7" into { name: 'chapter', chapterNumber: 7 }. Unknown URLs fall back
 * to the title screen. (`/^\/chapter\/(\d{1,2})$/` = "/chapter/" then 1–2 digits, captured.)
 */
export function parseHash(hash: string): AppRoute {
  const path = hash.replace(/^#/, '').replace(/\/+$/, '') || '/';
  if (path === '/' || path === '') return { name: 'intro' };
  if (path === '/path' || path === '/journey') return { name: 'journey' };
  if (path === '/map' || path === '/explore') return { name: 'explore' };
  if (path === '/about') return { name: 'about' };
  const chapter = /^\/chapter\/(\d{1,2})$/.exec(path);
  if (chapter) return { name: 'chapter', chapterNumber: Number(chapter[1]) };
  return { name: 'intro' };
}

/** Lets React re-read the URL whenever the part after # changes. */
function subscribe(listener: () => void): () => void {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

/** Current hash, e.g. "#/about". */
const getHash = () => window.location.hash;

/** Returns the current route and a `navigate('/about')` function. */
export function useHashRoute(): [AppRoute, (path: string) => void] {
  const hash = useSyncExternalStore(subscribe, getHash);
  const navigate = useCallback((path: string) => {
    window.location.hash = path;
  }, []);
  return [parseHash(hash), navigate];
}
