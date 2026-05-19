import { defineConfig } from '@playwright/test'

// E2E test config. The harness boots the built bundle in real Chromium against
// a static fixture page that mimics the minimal contract the Shopify theme
// provides (see local-repo/shopify/assets/tfr.js for the reference). Firebase
// is mocked via InitParams.testHooks (see src/lib/firebase-mock.ts); the REST
// API is mocked via page.route() (see tests/e2e/mocks/api.ts).
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    // Build fresh so the suite always runs against the current src/. `serve`
    // exposes the repo root with CORS — both /dist/index.js and the test
    // fixtures are reachable from the same origin.
    command: 'npm run build && npm run serve',
    url: 'http://127.0.0.1:5173/dist/index.js',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
