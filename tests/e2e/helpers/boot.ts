import type { Page } from '@playwright/test'
import { installApiMocks, type ApiMockOverrides } from '../mocks/api'
import {
  TEST_BRAND_ID,
  TEST_CURRENT_PRODUCT,
  TEST_EMAIL,
  TEST_ID_TOKEN,
  TEST_UID,
  TEST_USER_PROFILE,
} from '../fixtures/seed'

export interface BootSdkOptions {
  // Override pieces of the default test config. Anything not specified gets
  // the happy-path defaults from fixtures/seed.ts.
  brandId?: number
  currentProduct?: typeof TEST_CURRENT_PRODUCT | null
  loggedIn?: boolean // default true (seeds TestHooks.auth with the standard test user)
  apiOverrides?: ApiMockOverrides
  // Pre-seeded firestore documents. Keyed by collection → docId → data. The
  // MockFirestoreManager's queryDocs returns every doc in the collection
  // regardless of constraints, so doc IDs are arbitrary — the doc shape just
  // needs the fields the SDK actually reads. See fixtures/seed.ts for
  // ready-made shapes (e.g. TEST_SEEDED_STYLE).
  firestoreDocs?: Record<string, Record<string, unknown>>
}

/**
 * Boot the SDK in the test host fixture with sensible defaults. Returns once
 * `init(...)` has resolved (signalled by the `tfr:test:init-complete` event
 * the host fixture dispatches).
 */
export async function bootSdk(page: Page, options: BootSdkOptions = {}): Promise<void> {
  const {
    brandId = TEST_BRAND_ID,
    currentProduct = TEST_CURRENT_PRODUCT,
    loggedIn = true,
    apiOverrides,
    firestoreDocs,
  } = options

  await installApiMocks(page, apiOverrides)

  // Build the test config and stash it on `window` BEFORE the page's inline
  // script runs. The fixture HTML reads `__TFR_TEST_CONFIG__` and threads it
  // into `init({ ..., testHooks })`.
  await page.addInitScript(
    ({ brandId, currentProduct, loggedIn, uid, email, idToken, profile, firestoreDocs }) => {
      const testHooks: Record<string, unknown> = {}
      if (loggedIn) {
        testHooks.auth = { uid, email, idToken, profile }
      }
      if (firestoreDocs) {
        testHooks.firestore = { docs: firestoreDocs }
      }
      ;(window as unknown as { __TFR_TEST_CONFIG__: unknown }).__TFR_TEST_CONFIG__ = {
        brandId,
        environment: 'demo',
        currentProduct,
        testHooks,
      }
    },
    {
      brandId,
      currentProduct,
      loggedIn,
      uid: TEST_UID,
      email: TEST_EMAIL,
      idToken: TEST_ID_TOKEN,
      profile: TEST_USER_PROFILE,
      firestoreDocs: firestoreDocs ?? null,
    },
  )

  await page.goto('/tests/e2e/fixtures/host.html')

  // The fixture dispatches `tfr:test:init-complete` once init() resolves.
  await page.waitForFunction(
    () => (window as unknown as { __TFR_TEST_INIT_OK__?: boolean }).__TFR_TEST_INIT_OK__ === true,
    undefined,
    {
      timeout: 10_000,
    },
  )
}
