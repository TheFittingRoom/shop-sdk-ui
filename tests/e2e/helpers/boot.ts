import type { Page } from '@playwright/test'
import type { FirestoreUser } from '../../../src/api/gen/responses'
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
  // Extra products resolvable through the merchant `productLookup` callback,
  // beyond `currentProduct`. Needed whenever a test has fitting-room items for
  // products other than the one "being viewed" — e.g. two selectable rail
  // cards. host.html already merges these into its lookup catalog.
  productCatalog?: (typeof TEST_CURRENT_PRODUCT)[]
  loggedIn?: boolean // default true (seeds TestHooks.auth with the standard test user)
  // Further accounts the sign-in form can sign in to (TestHooks.accounts).
  // An account without a profile has none until the test writes users/<uid>.
  accounts?: { uid: string; email: string; idToken: string; profile?: FirestoreUser }[]
  apiOverrides?: ApiMockOverrides
  // Pre-seeded firestore documents. Keyed by collection → docId → data. The
  // MockFirestoreManager's queryDocs returns every doc in the collection
  // regardless of constraints, so doc IDs are arbitrary — the doc shape just
  // needs the fields the SDK actually reads. See fixtures/seed.ts for
  // ready-made shapes (e.g. TEST_SEEDED_STYLE).
  firestoreDocs?: Record<string, Record<string, unknown>>
  // Help popups (src/lib/help-tips.ts) are marked seen before boot unless this
  // is true: they sit over the controls other specs click. help-tips.spec.ts
  // opts in.
  helpTips?: boolean
}

// Every HelpTipId in src/lib/help-tips.ts.
const ALL_HELP_TIPS = [
  'fitting_room_icon',
  'add_to_fitting_room',
  'fitting_room_card',
  'fitting_room_try_it_on',
  'avatar_rotate',
  'sheet_swipe_up',
  'sheet_expand_item',
  'try_on_back',
  'detail_expand_item',
]

/**
 * Boot the SDK in the test host fixture with sensible defaults. Returns once
 * `init(...)` has resolved (signalled by the `tfr:test:init-complete` event
 * the host fixture dispatches).
 */
export async function bootSdk(page: Page, options: BootSdkOptions = {}): Promise<void> {
  const {
    brandId = TEST_BRAND_ID,
    currentProduct = TEST_CURRENT_PRODUCT,
    productCatalog,
    loggedIn = true,
    apiOverrides,
    firestoreDocs,
    accounts,
    helpTips = false,
  } = options

  await installApiMocks(page, apiOverrides)

  if (!helpTips) {
    await page.addInitScript((ids) => {
      window.localStorage.setItem('tfr:help-tips:v1', JSON.stringify(Object.fromEntries(ids.map((id) => [id, true]))))
    }, ALL_HELP_TIPS)
  }

  // Build the test config and stash it on `window` BEFORE the page's inline
  // script runs. The fixture HTML reads `__TFR_TEST_CONFIG__` and threads it
  // into `init({ ..., testHooks })`.
  await page.addInitScript(
    ({ brandId, currentProduct, productCatalog, loggedIn, uid, email, idToken, profile, firestoreDocs, accounts }) => {
      const testHooks: Record<string, unknown> = {}
      if (loggedIn) {
        testHooks.auth = { uid, email, idToken, profile }
      }
      if (firestoreDocs) {
        testHooks.firestore = { docs: firestoreDocs }
      }
      if (accounts) {
        testHooks.accounts = accounts
      }
      ;(window as unknown as { __TFR_TEST_CONFIG__: unknown }).__TFR_TEST_CONFIG__ = {
        brandId,
        environment: 'demo',
        currentProduct,
        productCatalog,
        testHooks,
      }
    },
    {
      brandId,
      currentProduct,
      productCatalog: productCatalog ?? null,
      loggedIn,
      uid: TEST_UID,
      email: TEST_EMAIL,
      idToken: TEST_ID_TOKEN,
      profile: TEST_USER_PROFILE,
      firestoreDocs: firestoreDocs ?? null,
      accounts: accounts ?? null,
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
