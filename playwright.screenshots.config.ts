import { defineConfig } from '@playwright/test'
import base from './playwright.config'

// `npm run screenshots`: the try-on screens as PNGs (tests/screenshots/
// scenes.spec.ts). Same harness and server as the e2e suite, kept out of it.
export default defineConfig({
  ...base,
  testDir: './tests/screenshots',
  retries: 0,
  reporter: 'list',
})
