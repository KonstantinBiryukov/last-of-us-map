/**
 * deploy-gh-pages.mjs — publish the site exactly like before: build, then push
 * the contents of dist/ to the `gh-pages` branch. GitHub Pages serves that
 * branch at https://konstantinbiryukov.github.io/last-of-us-map/ .
 *
 * Run with:  npm run deploy
 *
 * This replaces the old scripts/gh-pages-deploy.js (which used execa and
 * temporary orphan branches) with the well-tested `gh-pages` package. It never
 * touches your working branch or uncommitted files.
 */
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import ghpages from 'gh-pages';

// 1) Warn early if the Mapbox token is missing: the site would fall back to the simplified map.
const envFile = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
const hasToken = /^VITE_MAPBOX_TOKEN=pk\./m.test(envFile) || process.env.VITE_MAPBOX_TOKEN?.startsWith('pk.');
if (!hasToken) {
  console.warn('\n⚠  No VITE_MAPBOX_TOKEN found (.env.local or environment).');
  console.warn('   The published site will show the simplified fallback map.\n');
}

// 2) Type-check and build (npm run build does both).
console.log('Building…');
execSync('npm run build', { stdio: 'inherit' });

// 3) Sanity checks on the output before publishing anything.
const html = readFileSync('dist/index.html', 'utf8');
if (!html.includes('/last-of-us-map/assets/')) {
  throw new Error('dist/index.html does not use the /last-of-us-map/ base path — refusing to deploy.');
}
if (!existsSync('dist/.nojekyll')) throw new Error('dist/.nojekyll is missing — refusing to deploy.');

// 4) Publish dist/ to the gh-pages branch (dotfiles included so .nojekyll is kept).
console.log('Publishing dist/ to the gh-pages branch…');
await ghpages.publish('dist', {
  branch: 'gh-pages',
  dotfiles: true,
  message: `Deploy ${new Date().toISOString()}`,
});
console.log('Done. Check https://konstantinbiryukov.github.io/last-of-us-map/#/ in a minute or two.');
