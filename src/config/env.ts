/**
 * env.ts — configuration that comes from the environment (.env.local) at build time.
 *
 * VITE_MAPBOX_TOKEN is a Mapbox *public* token ("pk.…"). It is not a secret in
 * the way a password is: every visitor's browser needs it to download map
 * tiles, so it ends up inside the published JavaScript. Protect it by adding
 * URL restrictions in the Mapbox dashboard (see .env.example), and never commit
 * a secret ("sk.…") token.
 */

const rawToken: unknown = import.meta.env['VITE_MAPBOX_TOKEN'];

/** The token, or `null` if none was configured (the app then shows a fallback map). */
export const MAPBOX_TOKEN: string | null =
  typeof rawToken === 'string' && rawToken.startsWith('pk.') ? rawToken : null;

/** True during `npm run dev`; used to expose debugging helpers. */
export const IS_DEV = import.meta.env.DEV;
