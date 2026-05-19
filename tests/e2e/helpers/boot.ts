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
}

/**
 * Boot the SDK in the test host fixture with sensible defaults. Returns once
 * `init(...)` has resolved (signalled by the `tfr:test:init-complete` event
 * the host fixture dispatches).
 */
export async function bootSdk(page: Page, options: BootSdkOptions = {}): Promise<void> {
  const { brandId = TEST_BRAND_ID, currentProduct = TEST_CURRENT_PRODUCT, loggedIn = true, apiOverrides } = options

  await installApiMocks(page, apiOverrides)

  // Build the test config and stash it on `window` BEFORE the page's inline
  // script runs. The fixture HTML reads `__TFR_TEST_CONFIG__` and threads it
  // into `init({ ..., testHooks })`.
  await page.addInitScript(
    ({ brandId, currentProduct, loggedIn, uid, email, idToken, profile }) => {
      ;(window as unknown as { __TFR_TEST_CONFIG__: unknown }).__TFR_TEST_CONFIG__ = {
        brandId,
        environment: 'demo',
        currentProduct,
        testHooks: loggedIn ? { auth: { uid, email, idToken, profile } } : {},
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
