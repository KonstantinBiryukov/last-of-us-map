/**
 * playwright.config.ts — cross-browser smoke tests (npm run test:browsers).
 *
 * Playwright drives REAL browser engines that it downloads itself (`npx playwright install`),
 * so nothing has to be installed on the computer: Chromium (Chrome, Edge), Firefox, and WebKit
 * (the engine inside Safari, on Mac and on every iPhone and iPad). Each engine runs the same
 * test (e2e/smoke.e2e.ts) on a desktop screen, plus two phones: an iPhone (WebKit) and an
 * Android phone (Chromium), with their screen sizes, touch and user agents.
 *
 * The tests open the local dev server (http://localhost:5173 — the Mapbox token only works
 * there), starting it if it is not already running.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts', // not *.test.ts: those are Vitest's unit tests
  outputDir: 'e2e-results/artifacts',
  timeout: 180_000, // a 3D map loading in a software-rendered (no GPU) browser takes a while
  fullyParallel: false,
  workers: 1, // one browser at a time: they all share the one dev server and Mapbox's tiles
  reporter: [['list'], ['html', { outputFolder: 'e2e-results/report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173/last-of-us-map/',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/last-of-us-map/',
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Without a GPU, Chromium draws WebGL in software (SwiftShader) only when allowed to.
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], launchOptions: { firefoxUserPrefs: { 'webgl.force-enabled': true } } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'iphone', use: { ...devices['iPhone 14'] } },
    {
      name: 'android',
      use: { ...devices['Pixel 7'], launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
    },
  ],
});
