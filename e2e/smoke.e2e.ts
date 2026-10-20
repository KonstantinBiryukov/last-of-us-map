/**
 * smoke.e2e.ts — does the site WORK in this browser? (Run by Playwright in every engine and on
 * the phones: see playwright.config.ts.)
 *
 * It walks through what a visitor does and stops at the first thing that breaks:
 *   1. the title screen appears, with its buttons;
 *   2. "Begin the journey" starts the 3D map (WebGL) and the story;
 *   3. a few chapters are visited (Austin, Pittsburgh, Lakeside Resort, Salt Lake City), each
 *      photographed once the map has settled — so the props, characters and effects can be
 *      looked at in every browser;
 *   4. "Explore the map" opens the free map.
 * Along the way it records every error the page reports. A crash (an uncaught exception)
 * fails the test; console error messages are listed in the report to be read.
 *
 * Screenshots land in e2e-results/screens/<browser>-<step>.png.
 */
import { expect, test, type Page } from '@playwright/test';

/** Messages that are expected and harmless (blocked telemetry, a missing favicon size, …). */
const IGNORED = [/events\.mapbox\.com/, /favicon/i, /Failed to load resource.*\b(204|net::ERR_ABORTED)\b/];

/** What the dev build puts on `window` for inspection (see useJourneyRuntime.ts). */
interface JourneyWindow {
  __journey?: { engine: { pause(): void; goToChapter(i: number): void; seekInChapter(f: number): void } };
}

/** Waits until the dev build's story engine exists (the route has loaded). */
async function waitForEngine(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean((window as unknown as JourneyWindow).__journey), undefined, { timeout: 90_000 });
}

/** Saves a screenshot for this browser and step. */
async function snap(page: Page, browser: string, step: string): Promise<void> {
  await page.screenshot({ path: `e2e-results/screens/${browser}-${step}.png` });
}

test('the journey works from the title screen to Explore the map', async ({ page }, testInfo) => {
  const browser = testInfo.project.name;
  const crashes: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (error) => crashes.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (!IGNORED.some((pattern) => pattern.test(text))) consoleErrors.push(text);
  });

  // 1. Title screen.
  await page.goto('#/');
  await expect(page.getByRole('heading', { name: /the last of us/i })).toBeVisible();
  const begin = page.getByRole('button', { name: /begin the journey/i });
  await expect(begin).toBeEnabled({ timeout: 90_000 }); // enabled once the route has downloaded
  await snap(page, browser, '1-title');

  // 2. Start the journey: the map canvas appears and WebGL did not fail.
  await begin.click();
  await expect(page.locator('canvas.mapboxgl-canvas')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/WebGL is unavailable/i)).toHaveCount(0);
  await waitForEngine(page);

  // 3. A few chapters, each photographed once the camera and tiles have settled.
  for (const [index, name] of [[0, 'austin'], [4, 'pittsburgh'], [8, 'lakeside'], [10, 'saltlake']] as const) {
    await page.evaluate(
      ([i]) => {
        const engine = (window as unknown as JourneyWindow).__journey!.engine;
        engine.pause();
        engine.goToChapter(i);
        engine.pause();
        engine.seekInChapter(0.55);
      },
      [index],
    );
    await page.waitForTimeout(9_000);
    await snap(page, browser, `2-${name}`);
  }

  // 4. Explore the map.
  await page.goto('#/map');
  await page.waitForTimeout(8_000);
  await snap(page, browser, '3-explore');

  // The verdict: no crashes. Console errors are attached to the report for reading.
  await testInfo.attach('console-errors.txt', { body: consoleErrors.join('\n') || '(none)', contentType: 'text/plain' });
  console.log(`[${browser}] console errors: ${consoleErrors.length}${consoleErrors.length ? '\n  ' + consoleErrors.slice(0, 8).join('\n  ') : ''}`);
  expect(crashes, `uncaught errors in ${browser}`).toEqual([]);
});
