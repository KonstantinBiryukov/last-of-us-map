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
//
// IMPORTANT: gh-pages v6 reports failures ONLY through the callback — the promise it returns
// always resolves, even when the upload to GitHub fails (without a callback the error goes to
// a hidden debug log). Awaiting that promise made a failed upload look like success ("Done"
// while GitHub still had the old site). So we wrap the callback in our own promise, which
// rejects with the real error.
console.log('Publishing dist/ to the gh-pages branch… (uploading can take a minute)');
await new Promise((resolve, reject) => {
  ghpages.publish(
    'dist',
    { branch: 'gh-pages', dotfiles: true, message: `Deploy ${new Date().toISOString()}` },
    (error) => (error ? reject(error) : resolve()),
  );
}).catch((error) => {
  console.error('\n✖  Publishing failed — GitHub still has the previous version of the site.');
  console.error(`   ${error.message}\n`);
  if (/RPC failed|HTTP 4\d\d|curl|hung up|unexpected disconnect|early EOF/i.test(error.message)) {
    console.error('   This looks like a large upload being cut off. Try once:');
    console.error('     git config --global http.postBuffer 524288000');
    console.error('   and run npm run deploy again.\n');
  }
  process.exit(1);
});

// 5) Double-check that GitHub really has the new version before saying so.
const remote = execSync('git ls-remote origin refs/heads/gh-pages', { encoding: 'utf8' }).trim().split(/\s+/)[0];
// gh-pages keeps its working copy in a cache folder named after the repository URL.
const repoUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
const cache = ghpages.getCacheDir(repoUrl);
const local = execSync('git rev-parse HEAD', { cwd: cache, encoding: 'utf8' }).trim();
if (remote !== local) {
  console.error(`\n✖  GitHub's gh-pages (${remote?.slice(0, 7)}) does not match the published build (${local.slice(0, 7)}).`);
  console.error('   The upload did not complete; run npm run deploy again.\n');
  process.exit(1);
}
console.log(`Done — GitHub's gh-pages is now ${local.slice(0, 7)}.`);
console.log('Check https://konstantinbiryukov.github.io/last-of-us-map/#/ in a minute or two (hard-refresh: Cmd+Shift+R).');
